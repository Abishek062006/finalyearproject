"""
The whole Phase 7 experiment in one command — train, evaluate, analyse,
export, report:

    python -m ml.run_all              (full run)
    set AURA_SMOKE=1 & python -m ml.run_all     (Windows: a few-minute check)

Safe to re-run: finished folds and the final model are reused. Everything
the paper needs ends up in ml/results/REPORT.md (+ the JSON behind it).
"""
import json
import platform
import time

import numpy as np
import torch

from ml import analysis, evaluate, train
from ml.metrics import METRICS
from ml.model import AsdOnly, DualSaliencyNet

ONNX = train.CKPT / "aura_asd_saliency.onnx"


def export_onnx(final_ckpt) -> dict:
    """The deployable model for AURA's backend (onnxruntime): image -> autistic attention map."""
    dual = DualSaliencyNet(pretrained=False)
    dual.load_state_dict(torch.load(final_ckpt, map_location="cpu"))
    model = AsdOnly(dual).eval()
    x = torch.rand(1, 3, *train.data.TRAIN_HW)
    torch.onnx.export(model, x, str(ONNX), input_names=["image"], output_names=["asd_attention"], opset_version=17, dynamo=False)
    import onnxruntime as ort

    ref = model(x).detach().numpy()
    got = ort.InferenceSession(str(ONNX), providers=["CPUExecutionProvider"]).run(None, {"image": x.numpy()})[0]
    diff = float(np.abs(ref - got).max() / (np.abs(ref).max() + 1e-12))
    train.log(f"ONNX exported: {ONNX.name}, max relative difference vs PyTorch {diff:.2e}")
    return {"path": str(ONNX), "max_rel_diff": diff, "input": "1x3x240x320 RGB in [0,1]", "output": "1x240x320 probabilities"}


def _fmt(v: float) -> str:
    return f"{v:.3f}"


def _p(p: float) -> str:
    return "<0.001" if p < 0.001 else f"{p:.3f}"


def write_report(ev: dict, an: dict, onnx: dict, seconds: float) -> None:
    s = ev["summary"]
    L = [
        "# Phase 7 report — autism-specific attention model (Saliency4ASD)",
        "",
        f"Hardware: {platform.platform()}, device {train.device()}"
        + (f" ({torch.cuda.get_device_name(0)})" if torch.cuda.is_available() else "")
        + f". Total time {seconds / 3600:.2f} h. 5-fold cross-validation over 300 images (each fold: 240 train / 60 test); every number is on held-out images."
        + (" **SMOKE TEST — numbers are meaningless.**" if train.SMOKE else ""),
        "",
    ]
    for g, title in (("ASD", "autistic children's gaze"), ("TD", "typically developing children's gaze")):
        L += [f"## 1. Predicting {title}", "", "| Model | " + " | ".join(f"{m} {'(lower better)' if m == 'KLD' else ''}".strip() for m in METRICS) + " |", "|---|" + "---|" * len(METRICS)]
        for key, label in evaluate.ROWS:
            L.append(f"| {label} | " + " | ".join(_fmt(s[f'{key}|{g}'][m]) for m in METRICS) + " |")
        L.append("")
    L += [
        "## 2. Is Dual (ours) significantly better on autistic children's gaze?",
        "",
        "Paired Wilcoxon signed-rank tests on per-image scores, Holm-corrected per metric; mean difference (Dual minus other) with 95% bootstrap CI.",
        "",
        "| Metric | vs | mean diff [95% CI] | p (Holm) | Dual better & significant |",
        "|---|---|---|---|---|",
    ]
    for t in ev["asd_tests"]:
        L.append(f"| {t['metric']} | {t['vs']} | {t['mean_diff']:+.3f} [{t['ci95'][0]:+.3f}, {t['ci95'][1]:+.3f}] | {_p(t['p_holm'])} | {'yes' if t['ours_better'] and t['significant'] else 'no'} |")
    L += ["", "Dual's TD head vs the TD-only network on typical children's gaze (does sharing the network cost anything?):", "", "| Metric | mean diff [95% CI] | p |", "|---|---|---|"]
    for t in ev["td_tests"]:
        L.append(f"| {t['metric']} | {t['mean_diff']:+.3f} [{t['ci95'][0]:+.3f}, {t['ci95'][1]:+.3f}] | {_p(t['p_holm'])} |")

    ta = an["target_attention"]
    L += [
        "",
        "## 3. Does the model predict how much autistic children look at an object? (real gaze)",
        "",
        f"{ta['n_boxes']} labelled objects (faces, people, animals, objects, vehicles, food…). Spearman correlation between predicted and REAL share of autistic gaze on each object, held-out images only.",
        "",
        "| Model | Spearman rho | mean abs. error |",
        "|---|---|---|",
    ]
    for key, v in ta["predict_asd_share"].items():
        L.append(f"| {key} | {v['spearman_rho']:.3f} | {v['mae']:.3f} |")
    lo, hi = ta["dual_vs_tdonly_rho_ci95"]
    L += [
        "",
        f"Dual rho minus TD-only rho, 95% bootstrap CI: [{lo:+.3f}, {hi:+.3f}] ({'Dual significantly better' if lo > 0 else 'not significantly different' if lo <= 0 <= hi else 'TD-only better'}).",
        "",
        "**Where autistic and typical attention differ.** Real ASD-minus-TD gaze share per object, and whether each approach predicts that gap:",
        "",
        f"- Dual (ASD head minus TD head): rho = {ta['group_gap']['dual_rho']:.3f}",
        f"- Two separate networks (ASD-only minus TD-only): rho = {ta['group_gap']['separate_rho']:.3f}",
        f"- Difference, 95% bootstrap CI: [{ta['group_gap']['dual_minus_separate_ci95'][0]:+.3f}, {ta['group_gap']['dual_minus_separate_ci95'][1]:+.3f}]",
        "",
        "| Object type | n | real ASD share | real TD share | p (Wilcoxon) |",
        "|---|---|---|---|---|",
    ]
    for lab, v in ta["real_gap_by_label"].items():
        L.append(f"| {lab} | {v['n']} | {v['asd_share']:.3f} | {v['td_share']:.3f} | {_p(v['p'])} |")

    ed = an["editing"]
    if ed["n_targets"]:
        L += [
            "",
            "## 4. Editing learning images (model-predicted)",
            "",
            f"{ed['n_targets']} non-human target objects on held-out images. Everything outside the target is softened (blur + desaturate) with the smallest of four strengths that Dual predicts is enough. Scored by an independent judge: {ed['judge']}.",
            "",
            f"- Predicted share of autistic attention on the target: {ed['mean_share_before']:.3f} before -> {ed['mean_share_after']:.3f} after (mean gain 95% CI [{ed['mean_gain_ci95'][0]:+.3f}, {ed['mean_gain_ci95'][1]:+.3f}], Wilcoxon p {_p(ed['p_wilcoxon']) if ed['p_wilcoxon'] is not None else 'n/a'}).",
            f"- Targets that gained attention: {100 * ed['share_improved']:.0f}%. Strengths used: {ed['strengths_used']}.",
            "- Caveat: this is a model's prediction of attention on edited images; confirming it needs eye-tracking or learning outcomes with children (pilot).",
        ]
    L += [
        "",
        "## 5. Deployable model",
        "",
        f"ONNX file (not in git; too large and derived from licensed data): `{onnx['path']}`; input {onnx['input']}, output {onnx['output']}; max relative difference vs PyTorch {onnx['max_rel_diff']:.1e}.",
        "",
    ]
    name = "REPORT_SMOKE.md" if train.SMOKE else "REPORT.md"
    (train.RESULTS / name).write_text("\n".join(L), encoding="utf-8")
    train.log(f"report written: ml/results/{name}")


def main() -> None:
    t0 = time.time()
    preds = train.run_cross_validation()
    final = train.train_final_model()
    ev = evaluate.run(preds)
    an = analysis.run(preds)
    onnx = export_onnx(final)
    write_report(ev, an, onnx, time.time() - t0)
    json.dump({"seconds": time.time() - t0}, open(train.RESULTS / ("run_smoke.json" if train.SMOKE else "run.json"), "w", encoding="utf-8"))
    train.log("ALL DONE")


if __name__ == "__main__":
    main()
