# Entropy Dominance in Platform Competition

## Origin of the Intuition

Start with a question most people get wrong: what does Earth actually get from the sun?

The answer is not energy. Earth returns exactly as much energy to space as it receives —
if it kept more, temperatures would rise until balance was restored. What Earth gets is
*low-entropy* energy: a few concentrated, high-energy photons arrive from the sun, and
roughly twenty dispersed, low-energy infrared photons leave for space, carrying the same
total joules. The energy is conserved. The entropy increases. Everything that happens on
Earth — weather, ecosystems, life, thought — happens *in the process of that conversion*.
Earth is not fighting the second law of thermodynamics. It is the channel through which
entropy flows from a hot source (the sun) to a cold sink (space), and it captures a
fraction of that gradient to build complexity.

Now consider two competing platforms as two such systems.

Each receives concentrated input: developer effort, user attention, capital. Each produces
a downstream output: applications built, content created, transactions enabled, businesses
formed. The platform that converts its input into the richest, most diverse downstream
ecosystem is the better entropy processor — structurally analogous to the Earth that
supports biodiversity rather than a bare rock that reflects photons without doing anything
with the gradient.

The platform that restricts what can exist outside itself is the bare rock. The platform
that maximally expands the space of what is possible outside itself is the Earth. The
thesis is that competitive selection favors the latter.

This intuition came from thinking about Earth as a thermodynamic system, not from
information theory. Shannon entropy is a mathematical tool that formalizes the intuition
precisely — Shannon's formula has the same structure as Boltzmann's entropy by design,
so the thermodynamic analogy translates directly into a tractable model. The formalism
is borrowed. The intuition and the thesis are original.

## Core Thesis

The platform that wins is the one that maximally expands what is possible outside itself.
Ecosystem entropy — the Shannon entropy of the downstream activities, agents, and economic
arrangements a platform makes viable — is the primitive that determines competitive
outcomes, independently of network size.

## What the Paper Proposes

These are models built to test the intuition, not settled facts. The proofs show what
*follows mathematically from the model*. Whether the model captures reality is the
research question.

- At equal market share, the higher-entropy platform is always the best response;
  network effects cancel exactly, leaving downstream entropy as the sole selection
  criterion. [Theorem 1] — The empirical test: do agents actually respond to ecosystem
  breadth over platform size?
- Under any small-mutation dynamics, the max-entropy platform is the unique long-run
  survivor. [Theorem 2] — The empirical test: do historical displacement events follow
  entropy gaps, not size gaps?
- A smaller platform defeats a larger incumbent if and only if its entropy advantage
  exceeds a threshold set by the incumbent's network effect. [Theorem 3] — Directly
  falsifiable against Google/Yahoo, Android/Symbian, Ethereum/Bitcoin.
- Convergence speed is additive in entropy gap and network strength. [Theorem 4]
- Platforms underinvest in openness relative to the social optimum; the gap grows with
  network superlinearity. [Theorem 6] — A welfare claim requiring empirical identification
  of the model's parameters.

## The Line Not to Cross

This paper does not claim that more features win, or that internal platform complexity
wins. It claims that the breadth of what the platform makes possible for others —
measured by the Shannon entropy of realized downstream usage — is the selection criterion.
This is a research hypothesis. The models could be wrong. The goal is to state the
hypothesis precisely enough that it can be tested and, if necessary, rejected.

## What Is the Author's Contribution

The intuition: platforms compete as entropy-processing systems, and the one that generates
more downstream diversity wins — by the same logic that makes Earth a better system than
a bare rock. The thesis: downstream ecosystem entropy, not network size, is the
competitive primitive. The Carnot/Boltzmann/Shannon apparatus is borrowed to make the
claim mathematically precise and empirically testable.
