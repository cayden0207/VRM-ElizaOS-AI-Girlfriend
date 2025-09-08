# VRM + Mixamo Animation Example

This is a complete example showing how to apply Mixamo FBX animations to a VRM model with Three.js and @pixiv/three-vrm.

## 🌟 Features

- ✅ Load and render VRM models
- ✅ Load Mixamo FBX animation files
- ✅ Automatic retargeting (Mixamo → VRM)
- ✅ Smooth blending and cross‑fade
- ✅ Real‑time playback speed control
- ✅ Modern UI
- ✅ Robust error handling and status display

## 📁 Project Structure

```
VRM/
├── index.html                 # Main page
├── vrm-animation-retarget.js  # Retarget helper (optional)
├── Fliza VRM.vrm              # Your VRM model file
├── mixamo animation/          # Mixamo animations
│   ├── Crying.fbx
│   ├── Happy.fbx
│   ├── Neutral Idle.fbx
│   ├── Thinking.fbx
│   └── ... (more)
└── README.md                  # This document
```

## 🚀 Quick Start

### 1) Prepare files

Make sure the project contains:
- `Fliza VRM.vrm` – your VRM file
- `mixamo animation/` – a folder with Mixamo FBX files

### 2) Start a local server

Browsers block local file access; run via an HTTP server.

**Option A: Python**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Option B: Node.js**
```bash
npx http-server -p 8000
```

**Option C: VS Code Live Server**

### 3) Open the app

Visit `http://localhost:8000`.

## 🎮 Usage

### Control panel

- Animation buttons: play different animations
- Speed: adjust playback speed (0–2x)
- Cross‑fade time: transition duration between clips

### Camera controls

- Drag: orbit
- Wheel: zoom
- Right‑drag: pan

## 🔧 Implementation

### Stack

- **Three.js** – rendering
- **@pixiv/three-vrm** – VRM support
- **FBXLoader** – FBX loading
- **OrbitControls** – camera control

### Bone mapping

The project contains a Mixamo → VRM mapping:

```javascript
const MIXAMO_TO_VRM_BONE_MAP = {
    'Hips': 'hips',
    'Spine': 'spine',
    'Spine1': 'chest',
    'Spine2': 'upperChest',
    'Neck': 'neck',
    'Head': 'head',
    // ... 更多骨骼映射
};
```

### Retarget pipeline

1. Load FBX and read animation clips
2. Iterate original tracks
3. Map Mixamo bones to VRM bones
4. Create new tracks targeting VRM nodes
5. Build the retargeted AnimationClip

## 📝 Add a new animation

### 1) Put the FBX file

Place the Mixamo FBX file into `mixamo animation/`.

### 2) Update config

Add an entry in `index.html`'s `animations` map:

```javascript
const animations = {
    'crying': './mixamo animation/Crying.fbx',
    'happy': './mixamo animation/Happy.fbx',
    'neutral': './mixamo animation/Neutral Idle.fbx',
    'thinking': './mixamo animation/Thinking.fbx',
    'newAnimation': './mixamo animation/NewAnimation.fbx'  // 添加这行
};
```

### 3) Add a button

```html
<button id="newAnimBtn" onclick="loadNewAnimation()">🆕 播放新动画</button>
```

### 4) Add handler

```javascript
window.loadNewAnimation = () => loadAnimation('newAnimation', 'newAnimBtn');
```

## 🔨 Customize & extend

### Tune retarget parameters

You can tweak these to improve results:

```javascript
// 在 retargetMixamoToVRM 函数中
const options = {
    scaleToVRM: true,           // 是否缩放到 VRM 尺寸
    adjustRotations: true,      // 是否调整旋转
    adjustPositions: true,      // 是否调整位置
    preserveHipsHeight: true    // 是否保持髋部高度
};
```

### Adjust mapping

If results are off, refine mapping or add conversions:

```javascript
// 四元数旋转调整示例
function adjustQuaternionForVRM(quaternionArray, boneName) {
    // 根据具体需求调整旋转
    // 例如：[x, y, z, w] = [-x, y, -z, w];
}
```

## 🐛 Troubleshooting

### 1) Model not visible
- Check VRM path
- Run via HTTP server
- Inspect browser console

### 2) Animation fails to load
- Verify FBX path
- Ensure FBX contains animation
- Confirm files are valid

### 3) Weird animation
- Refine bone mapping
- Check Mixamo bone names
- Try different space conversions

### 4) Performance
- Lower shadow size: `renderer.shadowMap.setSize(1024)`
- Disable unnecessary post‑processing
- Reduce mesh/texture sizes

## 📚 Resources

- [Three.js Docs](https://threejs.org/docs/)
- [VRM Spec](https://vrm.dev/)
- [@pixiv/three-vrm Docs](https://pixiv.github.io/three-vrm/)
- [Mixamo Library](https://www.mixamo.com/)

## 🤝 Contributing

Issues and PRs are welcome!

## 📄 License

MIT License

---

Note: This project is intended for learning how to integrate VRM with Mixamo. When using in production, ensure you comply with each asset’s license.
