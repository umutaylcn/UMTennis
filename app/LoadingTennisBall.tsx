"use client";

import { useEffect, useRef } from "react";
import { visibleSeam } from "./tennisBallGeometry";

const SIZE = 96;
const CENTER = SIZE / 2;
const RADIUS = 45;

function paintSphere(context: CanvasRenderingContext2D) {
  const felt = context.createRadialGradient(35, 30, 5, 52, 58, 55);
  felt.addColorStop(0, "#dce99b");
  felt.addColorStop(0.56, "#b8cc6a");
  felt.addColorStop(1, "#728b3d");
  context.beginPath();
  context.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
  context.fillStyle = felt;
  context.fill();
}

function paintFrame(context: CanvasRenderingContext2D, angle: number) {
  context.clearRect(0, 0, SIZE, SIZE);
  paintSphere(context);
  context.save();
  context.beginPath();
  context.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
  context.clip();

  for (const seam of visibleSeam(angle)) {
    context.beginPath();
    seam.forEach((point, index) => {
      const x = CENTER + point.x * RADIUS;
      const y = CENTER - point.y * RADIUS;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(56, 72, 35, .28)";
    context.lineWidth = 7;
    context.stroke();
    context.strokeStyle = "#edf0dd";
    context.lineWidth = 5;
    context.stroke();
  }

  const edgeShade = context.createRadialGradient(39, 32, 20, CENTER, CENTER, RADIUS);
  edgeShade.addColorStop(0, "rgba(255, 255, 255, .035)");
  edgeShade.addColorStop(0.72, "rgba(20, 39, 15, 0)");
  edgeShade.addColorStop(1, "rgba(20, 39, 15, .22)");
  context.fillStyle = edgeShade;
  context.fillRect(0, 0, SIZE, SIZE);
  context.restore();
}

export default function LoadingTennisBall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      paintFrame(context, ((now - startedAt) / 1000) * 2.1 + 0.55);
      frame = window.requestAnimationFrame(tick);
    };
    paintFrame(context, 0.55);
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <span className="match-loading-ball" aria-hidden="true"><canvas ref={canvasRef} width={SIZE} height={SIZE}/></span>;
}
