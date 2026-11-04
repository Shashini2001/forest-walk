# A Walk Through the Forest

An interactive 3D portfolio for **Shashini Ruwanthika**, an IT undergraduate focused on AI and machine learning. Instead of scrolling a normal page, visitors walk through a night forest. Each project sits at a stop along the path, and a guide narrates the story.

**Live site:** https://forest-walk-phi.vercel.app
**Demo video:** [Watch the demo](https://drive.google.com/file/d/1Sj4Kuh6btsP8zE7K-ROLSwKdZg5vMZta/view?usp=sharing)

## Features

- Scroll (or swipe on a phone) to walk. When you stop, she stops; scroll back and she walks backwards.
- 20 stops, each with a glowing lantern, a project card and a narrated caption.
- A treehouse she climbs by the real stairs, a boat ride down the river, a bridge and a waterfall.
- Guided auto-play, a female narrator voice (browser speech synthesis) and prev / next buttons.
- Responsive for laptop, desktop and phone. A light mode keeps it smooth on small GPUs (add `?hq` to the URL for high quality).

## Projects shown in the walk

| Project | Stack | Link |
| --- | --- | --- |
| Ella Go, multi-agent tourism assistant | Python, Streamlit, ChromaDB, RAG, Groq (Llama 3.1) | [GitHub](https://github.com/Shashini2001/ella-tourism-assistant) |
| Local Service Finder, web app with CI/CD | HTML, CSS, JavaScript, Docker, GitHub Actions, Vercel | [GitHub](https://github.com/Laka-Manu/devops_local_service_finder_app) |
| BookNest, online bookstore with reading tracker | Spring Boot, React, MongoDB, RabbitMQ, Docker | [GitHub](https://github.com/Shashini2001/booknest-microservices) |
| Fruit freshness and shelf-life prediction (MLOps) | Python, multimodal ML, MLOps | [GitHub](https://github.com/Shashini2001/fruit-freshness-mlops) |
| LankaGo, smart public transit and bus tracking | Kotlin, Firebase, Google Maps API | [GitHub](https://github.com/Shashini2001/lankago-app) |
| DermaMatch AI, skin analysis and recommendations | TensorFlow / Keras, MobileNetV2, Flask | [GitHub profile](https://github.com/Shashini2001) |

## Built with

- [three.js](https://threejs.org/) (WebGL), custom shaders for water, mist and stars
- [Vite](https://vitejs.dev/) for development and the build
- FBX characters and animations from Mixamo, GLB / GLTF scenery
- Deployed on [Vercel](https://vercel.com/)

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

```bash
npm run build     # production build in dist/
npm run preview   # preview the build
```

## Project structure

```
index.html        page, styles and overlay markup
src/main.js       the whole 3D world, story and controls
public/           models (GLB / GLTF / FBX), character animations, favicons
scripts/          check-assets.mjs (lists asset sizes at build time)
vercel.json       Vercel build settings and caching
```

Required character files in `public/` (names are case-sensitive on Vercel): `Walking.fbx` (with skin), `Waving.fbx`, `Talking.fbx`, `Paddling.fbx`. Optional: `Idle.fbx`, `Walking Up The Stairs.fbx`.

## Controls

| Input | Action |
| --- | --- |
| Scroll / swipe / arrow keys | Walk forward or back |
| Prev / next buttons | Jump between stops |
| Play button | Start or pause the guided walk |
| Voice button | Narrator on or off |
| `?hq` in the URL | High quality mode |

## Deploy

1. Push the project to GitHub.
2. In Vercel choose **Add New → Project**, import the repository and select the **Vite** preset.
3. Build command `npm run build`, output directory `dist`, then **Deploy**.

## Contact

- GitHub: https://github.com/Shashini2001
- LinkedIn: https://www.linkedin.com/in/ranasinghe-arachchige-shashini-ruwanthika-54a1962a6/
- TryHackMe: https://tryhackme.com/p/shashiniruwanthika607
- Email: shashiniruwanthika607@gmail.com
