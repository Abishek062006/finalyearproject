"""
The attention model: where will a child look in this picture?

Encoder: ResNet-50 pretrained on ImageNet (it already knows objects, faces,
text, textures). Decoder: features from three depths (fine edges → whole
objects) are projected, upsampled to a common size and fused, then combined
with a small set of learned Gaussian "centre-bias" maps — viewers on a
screen favour the middle, and how much they do differs between groups. The
output is a probability distribution over pixels (log-softmax), so the loss
can compare it directly with where children actually looked.

Training recipe (train.py): learn typical (TD) children's attention first,
then fine-tune on autistic (ASD) children's attention — so the network
starts from "how children look" and learns how autistic attention differs.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import ResNet50_Weights, resnet50

N_PRIORS = 8


class CentrePriors(nn.Module):
    """N learnable 2-D Gaussians (centre and spread), rendered at any size."""

    def __init__(self, n: int = N_PRIORS):
        super().__init__()
        g = torch.linspace(-0.4, 0.4, n)
        self.mu = nn.Parameter(torch.stack([g.roll(1) * 0.5, g * 0.5], dim=1))  # (n, 2) in [-1,1] coords
        self.log_sigma = nn.Parameter(torch.full((n, 2), -0.7))

    def forward(self, b: int, h: int, w: int) -> torch.Tensor:
        ys = torch.linspace(-1, 1, h, device=self.mu.device)
        xs = torch.linspace(-1, 1, w, device=self.mu.device)
        yy, xx = torch.meshgrid(ys, xs, indexing="ij")
        sig = self.log_sigma.exp()
        maps = torch.exp(-(((xx[None] - self.mu[:, 0, None, None]) ** 2) / (2 * sig[:, 0, None, None] ** 2) + ((yy[None] - self.mu[:, 1, None, None]) ** 2) / (2 * sig[:, 1, None, None] ** 2)))
        return maps[None].expand(b, -1, -1, -1)


class SaliencyNet(nn.Module):
    def __init__(self, pretrained: bool = True):
        super().__init__()
        r = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2 if pretrained else None)
        self.stem = nn.Sequential(r.conv1, r.bn1, r.relu, r.maxpool, r.layer1)  # /4, 256 ch
        self.l2, self.l3, self.l4 = r.layer2, r.layer3, r.layer4  # /8 512, /16 1024, /32 2048
        self.p2 = nn.Conv2d(512, 64, 1)
        self.p3 = nn.Conv2d(1024, 64, 1)
        self.p4 = nn.Conv2d(2048, 128, 1)
        self.fuse = nn.Sequential(
            nn.Conv2d(64 + 64 + 128 + N_PRIORS, 128, 3, padding=2, dilation=2),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 64, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 1, 1),
        )
        self.priors = CentrePriors()
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B,3,H,W) floats in [0,1]. Returns log-probabilities (B,H,W) over pixels."""
        b, _, h, w = x.shape
        x = (x - self.mean) / self.std
        f1 = self.stem(x)
        f2 = self.l2(f1)
        f3 = self.l3(f2)
        f4 = self.l4(f3)
        size = f2.shape[-2:]  # fuse at 1/8 resolution
        feats = [
            self.p2(f2),
            F.interpolate(self.p3(f3), size=size, mode="bilinear", align_corners=False),
            F.interpolate(self.p4(f4), size=size, mode="bilinear", align_corners=False),
            self.priors(b, *size),
        ]
        logits = self.fuse(torch.cat(feats, dim=1))
        logits = F.interpolate(logits, size=(h, w), mode="bilinear", align_corners=False)[:, 0]
        return F.log_softmax(logits.flatten(1), dim=1).view(b, h, w)


def saliency_loss(logp: torch.Tensor, density: torch.Tensor, fix: torch.Tensor) -> torch.Tensor:
    """KL divergence to the fixation density, minus correlation (CC), minus a
    little NSS — optimising the benchmark's own measures directly."""
    p = logp.exp()
    q = density / (density.flatten(1).sum(1).view(-1, 1, 1) + 1e-8)
    kld = (q * (torch.log(q + 1e-8) - logp)).flatten(1).sum(1)
    pz = (p - p.flatten(1).mean(1).view(-1, 1, 1)) / (p.flatten(1).std(1).view(-1, 1, 1) + 1e-8)
    qz = (q - q.flatten(1).mean(1).view(-1, 1, 1)) / (q.flatten(1).std(1).view(-1, 1, 1) + 1e-8)
    cc = (pz * qz).flatten(1).mean(1)
    fixf = fix.float()
    nss = (pz * fixf).flatten(1).sum(1) / (fixf.flatten(1).sum(1) + 1e-8)
    return (kld - cc - 0.1 * nss).mean()
