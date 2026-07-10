// Shared mutable scroll state — written by the DOM scroll listener (UI.jsx),
// damped + consumed inside the R3F frame loop (Experience.jsx).
export const scrollState = { progress: 0, damped: 0 }

// target morph particle di outro: 'face' | 'github' | 'linkedin'
// ditulis oleh tombol sosial di UI.jsx, dibaca ParticleFace.jsx tiap frame
export const faceState = { target: 'face' }
