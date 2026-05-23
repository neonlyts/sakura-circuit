# 🌸 Sakura Circuit

> A browser-based 3rd person racing game built as a tribute to the
> launch of Forza Horizon 6 (May 2026).

## 🎮 Play Now
👉 [Play Sakura Circuit](https://sakura-circuit.vercel.app)

## 🧪 About This Project
This project was an experiment to explore how far AI tooling has evolved
in 2026. Specifically, can a non-developer build a fully playable,
polished browser game using only natural language prompts?

The answer: yes, with some patience.

Built entirely using Emergent AI's app builder, the game was designed,
coded, and iterated through conversation alone. Vibe coding, you may say. From the Japan-themed landing page to the 3rd
person camera, car selection screen, AI opponents, everything was generated through prompts.

This was also a personal celebration of the launch of Forza Horizon 6,
set in Japan, which inspired the cherry blossom aesthetic, mountain
scenery, and JDM-inspired car names.

## 🏎️ Features
- 3rd person behind-the-car camera perspective
- 3 Japan-themed cars: Sakura Red, Tokyo Blue, Fuji Yellow
- AI opponents
- 3-lap race with timer and position tracker (P1/P2/P3)
- Cherry blossom trees and mountain scenery
- Daytime Japan aesthetic inspired by Forza Horizon 6

## 🕹️ Controls
- **WASD** or **Arrow Keys** to drive

## 🛠️ Built With
- [Emergent AI](https://emergent.sh) — AI app builder (no code written manually)
- React + CRACO
- Tailwind CSS
- Deployed on Vercel

## ⚔️ Deployment Challenges
The game was built and previewed inside Emergent's platform without
issues. However, deploying it externally turned out to be the real
challenge. Emergent's own hosting costs 50 credits/month, and after
building and iterating the game, only 45 credits remained.

This forced an alternative deployment path via Vercel, which surfaced
several issues:

- **Folder structure** — Emergent generates a full-stack project with
  separate frontend/backend folders. GitHub Pages couldn't serve from
  a nested `/frontend/public` path, ruling it out entirely.
- **Dependency conflicts** — `react-day-picker` and `date-fns` had
  incompatible peer dependencies, requiring `--legacy-peer-deps` to
  resolve.
- **Node.js version** — Node 24.x (Vercel's default) was incompatible;
  downgrading to 20.x resolved the runtime issues.


## 🎌 Tribute
Built to celebrate the launch of Forza Horizon 6 (May 19, 2026),
set in Japan. The game's aesthetic like cherry blossoms, mountain views,
daytime lighting is directly inspired by the game's Japanese open world.


## 📄 License
MIT — feel free to build on it, just give a nod back.
