"""
Attention models: where will a child look in this picture?

Trunk (shared by every model): ResNet-50 pretrained on ImageNet, with a
decoder that fuses features from three depths (fine edges -> whole objects)
at 1/8 resolution.

  SaliencyNet      one head: one group's attention (the TD-only and
                   ASD-only baselines).
  DualSaliencyNet  OURS - typical attention plus an explicit difference:
                     logits_TD  = head_TD(features)  + centre prior_TD
                     logits_ASD = logits_TD + head_DIFF(features) + prior_DIFF
                   trained on BOTH groups' gaze for the same images. The
                   difference head can only explain what is *different*
                   about autistic attention, and its output is itself a
                   map of where autistic and typical attention diverge.

Outputs are log-probabilities over pixels, compared with where children
actually looked by the loss below.
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
        self.mu = nn.Parameter(torch.stack([g.roll(1) * 0.5, g * 0.5], dim=1))
        self.log_sigma = nn.Parameter(torch.full((n, 2), -0.7))

    def forward(self, b: int, h: int, w: int) -> torch.Tensor:
        ys = torch.linspace(-1, 1, h, device=self.mu.device)
        xs = torch.linspace(-1, 1, w, device=self.mu.device)
        yy, xx = torch.meshgrid(ys, xs, indexing="ij")
        sig = self.log_sigma.exp()
        maps = torch.exp(
            -(((xx[None] - self.mu[:, 0, None, None]) ** 2) / (2 * sig[:, 0, None, None] ** 2)
              + ((yy[None] - self.mu[:, 1, None, None]) ** 2) / (2 * sig[:, 1, None, None] ** 2))
        )
        return maps[None].expand(b, -1, -1, -1)


class Trunk(nn.Module):
    def __init__(self, pretrained: bool = True):
        super().__init__()
        r = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2 if pretrained else None)
        self.stem = nn.Sequential(r.conv1, r.bn1, r.relu, r.maxpool, r.layer1)
        self.l2, self.l3, self.l4 = r.layer2, r.layer3, r.layer4
        self.p2 = nn.Conv2d(512, 64, 1)
        self.p3 = nn.Conv2d(1024, 64, 1)
        self.p4 = nn.Conv2d(2048, 128, 1)
        self.fuse = nn.Sequential(nn.Conv2d(256, 128, 3, padding=2, dilation=2), nn.ReLU(inplace=True))
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = (x - self.mean) / self.std
        f2 = self.l2(self.stem(x))
        f3 = self.l3(f2)
        f4 = self.l4(f3)
        size = f2.shape[-2:]
        feats = torch.cat(
            [
                self.p2(f2),
                F.interpolate(self.p3(f3), size=size, mode="bilinear", align_corners=False),
                F.interpolate(self.p4(f4), size=size, mode="bilinear", align_corners=False),
            ],
            dim=1,
        )
        return self.fuse(feats)  # (B,128,H/8,W/8)


class Head(nn.Module):
    """Features + centre priors -> one logit map."""

    def __init__(self):
        super().__init__()
        self.priors = CentrePriors()
        self.net = nn.Sequential(nn.Conv2d(128 + N_PRIORS, 64, 3, padding=1), nn.ReLU(inplace=True), nn.Conv2d(64, 1, 1))

    def forward(self, feats: torch.Tensor) -> torch.Tensor:
        b, _, h, w = feats.shape
        return self.net(torch.cat([feats, self.priors(b, h, w)], dim=1))[:, 0]


def _to_logp(logits: torch.Tensor, hw: tuple[int, int]) -> torch.Tensor:
    b = logits.shape[0]
    up = F.interpolate(logits[:, None].float(), size=hw, mode="bilinear", align_corners=False)[:, 0]
    return F.log_softmax(up.flatten(1), dim=1).view(b, *hw)


ENCODER_PREFIXES = ("trunk.stem", "trunk.l2", "trunk.l3", "trunk.l4")


class SaliencyNet(nn.Module):
    def __init__(self, pretrained: bool = True):
        super().__init__()
        self.trunk = Trunk(pretrained)
        self.head = Head()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return _to_logp(self.head(self.trunk(x)), x.shape[-2:])


class DualSaliencyNet(nn.Module):
    def __init__(self, pretrained: bool = True):
        super().__init__()
        self.trunk = Trunk(pretrained)
        self.td = Head()
        self.diff = Head()

    def forward(self, x: torch.Tensor, with_diff: bool = False):
        feats = self.trunk(x)
        td = self.td(feats)
        diff = self.diff(feats)
        hw = x.shape[-2:]
        out = (_to_logp(td + diff, hw), _to_logp(td, hw))  # (ASD, TD)
        if with_diff:
            return (*out, F.interpolate(diff[:, None].float(), size=hw, mode="bilinear", align_corners=False)[:, 0])
        return out


class AsdOnly(nn.Module):
    """Deployment wrapper: image (1,3,H,W in [0,1]) -> ASD attention probabilities (1,H,W)."""

    def __init__(self, dual: DualSaliencyNet):
        super().__init__()
        self.dual = dual

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dual(x)[0].exp()


def saliency_loss(logp: torch.Tensor, density: torch.Tensor, fix: torch.Tensor) -> torch.Tensor:
    """KL divergence to the fixation density, minus correlation (CC), minus a
    little NSS — optimising the benchmark's own measures directly."""
    logp = logp.float()
    p = logp.exp()
    q = density / (density.flatten(1).sum(1).view(-1, 1, 1) + 1e-8)
    kld = (q * (torch.log(q + 1e-8) - logp)).flatten(1).sum(1)
    pz = (p - p.flatten(1).mean(1).view(-1, 1, 1)) / (p.flatten(1).std(1).view(-1, 1, 1) + 1e-8)
    qz = (q - q.flatten(1).mean(1).view(-1, 1, 1)) / (q.flatten(1).std(1).view(-1, 1, 1) + 1e-8)
    cc = (pz * qz).flatten(1).mean(1)
    fixf = fix.float()
    nss = (pz * fixf).flatten(1).sum(1) / (fixf.flatten(1).sum(1) + 1e-8)
    return (kld - cc - 0.1 * nss).mean()
