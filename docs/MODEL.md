# The model, and where the measured data stops

This document draws a hard line between **what is measured** and **what is a
modelling choice**. The interesting part of this project is the first category;
the second category is where you should be sceptical.

---

## 1. Measured — taken directly from FlyWire v783

| Quantity | Value | Source |
|---|---|---|
| Neurons | 139,255 proofread | FlyWire v783 release |
| Directed connections (≥5 synapses) | 2,700,513 | aggregated per neuron pair |
| Total synapses in those connections | 34,153,568 | `syn_count` sums |
| Unthresholded pairs available | 15,091,983 | before the ≥5 cut |
| Per-neuron neurotransmitter | ACh 82,298 · Glu 19,605 · GABA 16,017 · DA 584 · 5-HT 1,021 · OA 72 · unknown 19,658 | Eckstein/Bates et al. predictions |
| Excitatory : inhibitory | 74.4% : 25.6% | derived from the NT call |
| Neuron 3-D coordinates | all 139,255 | soma where known, else neurite point |
| Cell classes | photoreceptors 11,392 · ORNs 2,281 · descending 1,303 · motor 110 | Schlegel et al. annotations |

Edge weight is the raw `syn_count`. Edge sign is a property of the
**presynaptic** neuron (Dale's law), not of the edge.

---

## 2. Modelling choices — these are ours, and they are contestable

### 2.1 Neurotransmitter → sign

```
acetylcholine              -> +1   excitatory
GABA                       -> -1   inhibitory
glutamate                  -> -1   inhibitory (GluCl- dominates in the fly)
dopamine / serotonin / octopamine -> +1
unknown                    -> +1
```

Lumping the monoamines with excitation follows Shiu et al. (2024) for
comparability. It is wrong in detail — these are neuromodulators whose effect
is slow, receptor-dependent and often not a simple current — but they are only
1.2% of neurons.

### 2.2 Neuron model

Leaky integrate-and-fire with the Shiu et al. (2024) parameter set:

| Parameter | Value |
|---|---|
| resting / reset potential | −52 mV |
| threshold | −45 mV |
| membrane time constant | 20 ms |
| refractory period | 2.2 ms |
| synaptic step | 0.275 mV per synapse |
| integration step | 1 ms |

Synaptic transmission is an instantaneous voltage step. There are no
conductances, no synaptic delays, no dendritic structure, no plasticity, no
gap junctions.

### 2.3 The global synaptic gain — the most important knob

`LIFParams.synaptic_scale`, default **0.14**.

At `synaptic_scale = 1.0` (the literal 0.275 mV) this reduced model does not
work. It has a bifurcation: any input ignites the whole brain into a
self-sustaining state at ~8% of neurons firing, and that state is identical no
matter what you stimulate. Measured here:

```
scale   stim LEFT eye           stim RIGHT eye         verdict
0.14    optic L 7.6 / R 0.0     optic L 0.0 / R 4.8    input-driven, lateralised
0.20    optic L 6.6 / R 1.7     optic L 1.1 / R 10.4   partial bleed-through
0.25    DN 47 / 41              DN 47 / 41             identical -> signal destroyed
```

The bifurcation sits near 0.15. We run at 0.14, just under it.

**Do not read this as "the fly brain would seize".** It is a statement about
*this* model: point neurons, no conductance-based shunting, no adaptation, no
delays, and a weight rule that gives an average connection ~12.6 synapses ≈
3.5 mV against a 7 mV threshold gap. Real neurons have many stabilising
mechanisms this model omits. The gain compensates for their absence.

### 2.4 Sensory input

World intensity (0–1) → afferent Poisson firing rate:

| Modality | Population | Rate at unit intensity |
|---|---|---|
| Light | `sensory` + `visual`, split by side | 600 Hz |
| Odour | `sensory` + `olfactory`, split by side | 500 Hz |
| Aversive | photoreceptors, split by side | 700 Hz |

Afferents are *forced to spike* as a Poisson process rather than injected with
current: a constant current pins them at the refractory ceiling and gives no
graded control.

The aversive channel reusing photoreceptors is a simplification — there is no
separate nociceptive afferent class in this annotation set.

### 2.5 Motor readout

```
rate_L, rate_R = smoothed firing rate of descending neurons by soma side
forward = 90  + 3.0 * (rate_L + rate_R) / 2      clamped to [0, 420]
turn    = 3.2 * turn_sign * (rate_R - rate_L) + N(0, 0.35)
```

This is the weakest link. Real *Drosophila* steering is not "sum the
descending neurons by which side their soma is on" — individual DNs such as
DNa02 have specific, characterised roles. Grouping 1,303 DNs into two pools by
soma side is a coarse proxy.

`turn_sign` is a free parameter. `+1` produces approach, `−1` produces
avoidance. **Both are the same brain**; only the sign of the readout differs.

The gains were tuned by grid search against a behavioural objective, not
derived from physiology. The grid is in the git history.

---

## 3. What the model actually does

From `python -m flybrain validate` (all numbers regenerated on every run):

```
[PASS] neuron count == 139,255            139,255
[PASS] edges == 2,700,513 (syn>=5)        2,700,513
[PASS] excitatory fraction 70-80%         74.4%
[PASS] left eye -> ipsilateral optic lobe L 7.64 Hz vs R 0.02 Hz
[PASS] descending bias is contralateral   stimL +0.51 Hz, stimR +0.69 Hz
[PASS] gain 0.14 below ignition           27.5 Hz at 0.14 vs 48.2 Hz at 0.25
[PASS] approach separates from avoid      near-source 47% vs 0% (chance 10.4%),
                                          mean dist 226 vs 457
```

Two of these are genuinely informative:

**Retinotopy survives.** Stimulating the left eye produces 7.64 Hz in the left
optic lobe and 0.02 Hz in the right — a 380× ratio that nobody coded. It falls
out of the wiring.

**The descending bias is contralateral and consistent.** Left eye → right DNs
fire more; right eye → left DNs fire more. That crossed mapping is what makes
taxis possible, and it was not designed in.

The behaviour itself (47% vs 0% occupancy near the source, against a 10.4%
chance level) depends on the tuned gains above, so it is a weaker claim than
the two open-loop results.

---

## 4. What this is not

- **Not a fly.** No body, no legs, no wings, no proprioception, no VNC. The
  ventral nerve cord is not in this dataset at all; descending neurons here
  simply stop.
- **Not predictive of real behaviour.** Nothing here has been fitted to or
  tested against fly behavioural data.
- **Not the whole nervous system.** FAFB v783 is the female adult *brain*.
- **Not a consciousness claim.** It is a sparse matrix and a threshold.
- **Not tuned by anything but the objective stated above.** Different gains
  give different behaviour; we report the search, not just the winner.

---

## 5. Citations

- Dorkenwald S. *et al.* (2024) *Neuronal wiring diagram of an adult brain.*
  Nature 634:124–138.
- Schlegel P. *et al.* (2024) *Whole-brain annotation and multi-connectome cell
  typing quantifies circuit stereotypy in Drosophila.* Nature 634:139–152.
- Eckstein N., Bates A.S. *et al.* (2024) *Neurotransmitter classification from
  electron microscopy images.* Cell 187:2574–2594.
- Shiu P.K. *et al.* (2024) *A leaky integrate-and-fire computational model
  based on the connectome of the entire adult Drosophila brain.* Nature
  634:210–219.
- FlyWire Consortium (2024) *FlyWire Whole-brain Connectome Connectivity Data.*
  Zenodo, `10.5281/zenodo.10676866`. CC-BY-4.0.
