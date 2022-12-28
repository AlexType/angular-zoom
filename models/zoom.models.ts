import { EventEmitter } from '@angular/core';

export interface ZoomServiceConfig {
  onDragReset: () => void;
  zoomChange: EventEmitter<number>;
}

export interface ScaleConfig {
  step: number;
  max: number;
  min: number;
  fit: number;
}

export interface ZoomTouches {
  start: TouchList;
  prevScale: number;
}

export interface ZoomTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface ZoomVelocity extends Coordinates {
  prevPositionX: number;
  prevPositionY: number;
  prevTime: number;
}

export interface Drag {
  dragging: boolean;
  start: Coordinates;
  lastCoordinates: Coordinates;
  availableAxis: { x: boolean; y: boolean };
}

export interface Coordinates {
  x: number;
  y: number;
}

export enum TouchZoomDirection {
  To = 1,
  Out = -1
}

export enum Direction {
  Positive = 1,
  Negative = -1,
}
