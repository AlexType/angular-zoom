import { Injectable } from '@angular/core';
import { Drag, ScaleConfig, ZoomServiceConfig, ZoomTouches, ZoomTransform, ZoomVelocity } from '../models/zoom.models';

@Injectable({
  providedIn: 'root'
})
export class ZoomService {
  private _zoomConfig: ZoomServiceConfig;

  private readonly _transform: ZoomTransform = {
    scale: 1,
    translateX: 0,
    translateY: 0
  };

  private _scaleConfig: ScaleConfig = {
    step: 0.5,
    min: 1,
    max: 6,
    fit: 6
  };

  private _touches: ZoomTouches = {
    start: null,
    prevScale: null,
  };

  private _drag: Drag = {
    dragging: false,
    start: { x: 0, y: 0 },
    lastCoordinates: { x: null, y: null },
    availableAxis: { x: true, y: true }
  };

  private _velocity: ZoomVelocity = {
    x: null,
    y: null,
    prevTime: null,
    prevPositionX: null,
    prevPositionY: null,
  };

  constructor() { }

  public get scale(): number {
    return this._transform.scale;
  }

  public get dragging(): boolean {
    return this._drag.dragging;
  }

  public get translateX(): number {
    return this._transform.translateX;
  }

  public get translateY(): number {
    return this._transform.translateY;
  }

  public set fitZoom(fit: number) {
    this._scaleConfig.fit = fit;
  }

  public init(config: ZoomServiceConfig): void {
    this._zoomConfig = config;
  }

  public dragStart(x: number, y: number): void {
    this._drag.dragging = true;
    this._drag.start = {
      x: x - this.translateX,
      y: y - this.translateY
    };
  }

  public dragMove(x: number, y: number) {
    this.translateTo(x - this._drag.start.x, y - this._drag.start.y);
  }

  public dragEnd(duration: number) {
    this._drag.dragging = false;
    this._drag.start = { x: 0, y: 0 };
    this.getMomentumDuration(duration);
    this.velocityReset();
  }

  public translateTo(x: number, y: number) {

    if (this._drag.availableAxis.x) {
      this._transform.translateX = x;
    }
    if (this._drag.availableAxis.y) {
      this._transform.translateY = y;
    }
  }

  public translateAdd(x: number, y: number, scaleCheck: boolean = false) {
    if (this.scale <= 1 && scaleCheck) {
      return;
    }

    this.translateTo(this.translateX + x, this.translateY + y);
  }

  public updateAvailableAxis(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number): void {
    this._drag.availableAxis = {
      x: containerWidth < Math.floor(imageWidth * this.scale),
      y: containerHeight < Math.floor(imageHeight * this.scale)
    };
  }

  public zoomIn(): void {
    this.changeScale(this.scale + this._scaleConfig.step);
  }

  public zoomOut(): void {
    this.changeScale(this.scale - this._scaleConfig.step);
  }

  public zoomToFit(): void {
    this.changeScale(this._scaleConfig.fit);
  }

  public zoomToInitial(): void {
    this.changeScale(1);
  }

  public zoomTo(to: number): void {
    this.changeScale(to);
  }

  public zoomWithStep(step: number): void {
    this.changeScale(this.scale + step);
  }

  public touchZoom(touches: TouchList): void {
    if (!this._touches.start) {
      this._touches.start = touches;
      this._touches.prevScale = this.scale - 1;
    }

    const endDistance = this.getTouchDistance(touches[0], touches[1]);
    const startDistance = this.getTouchDistance(this._touches.start[0], this._touches.start[1]);

    this.zoomTo(endDistance / startDistance + this._touches.prevScale);
  }

  public velocityReset(): void {
    this._velocity = {
      x: null,
      y: null,
      prevTime: null,
      prevPositionX: null,
      prevPositionY: null,
    };
  }

  public touchesReset(): void {
    this._touches = {
      start: null,
      prevScale: null,
    };
  }

  public dragReset(): void {
    this._drag = {
      dragging: false,
      start: { x: 0, y: 0 },
      lastCoordinates: { x: null, y: null },
      availableAxis: { x: true, y: true }
    };

    this._transform.translateX = 0;
    this._transform.translateY = 0;

    this._zoomConfig.onDragReset();
  }

  public calculateVelocity(x: number, y: number): void {
    this._drag.lastCoordinates = { x, y };

    if (!this._velocity.prevPositionX) this._velocity.prevPositionX = x;
    if (!this._velocity.prevPositionY) this._velocity.prevPositionY = y;
    if (!this._velocity.prevTime) this._velocity.prevTime = Date.now();

    this._velocity.x = (x - this._velocity.prevPositionX) / (Date.now() - this._velocity.prevTime) / 2;
    this._velocity.y = (y - this._velocity.prevPositionY) / (Date.now() - this._velocity.prevTime) / 2;

    if (Math.abs(x - this._velocity.prevPositionX) < 2) this._velocity.x = 0;
    if (Math.abs(y - this._velocity.prevPositionY) < 2) this._velocity.y = 0;

    this._velocity.prevPositionX = x;
    this._velocity.prevPositionY = y;
    this._velocity.prevTime = Date.now();
  }

  public fixOffsetExceeded(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number): void {
    const offsetAvailableX = Math.abs(containerWidth - imageWidth * this.scale) / 2;
    const offsetAvailableY = Math.abs(containerHeight - imageHeight * this.scale) / 2;

    const offsetX = offsetAvailableX + this.translateX;
    const offsetY = offsetAvailableY + this.translateY;

    const exceededX = this.calculateOffsetExceeded(offsetX, offsetAvailableX);
    const exceededY = this.calculateOffsetExceeded(offsetY, offsetAvailableY);

    this.translateAdd(exceededX, exceededY);
  }

  private calculateOffsetExceeded(free: number, available: number): number {
    if (free < 0) {
      return -free;
    }
    if (free > available * 2) {
      return available * 2 - free;
    }
    return 0;
  }

  private getMomentumDuration(duration: number): void {
    if (!this._velocity.prevTime) {
      return;
    }

    let momentumDurationX = duration;
    let momentumDurationY = duration;
    const momentumDistanceX = this._velocity.x * momentumDurationX;
    const momentumDistanceY = this._velocity.y * momentumDurationY;
    const newPositionX = this._drag.lastCoordinates.x + momentumDistanceX;
    const newPositionY = this._drag.lastCoordinates.y + momentumDistanceY;

    if (this._velocity.x !== 0) {
      momentumDurationX = Math.abs((newPositionX - this._drag.lastCoordinates.x) / this._velocity.x);
    }
    if (this._velocity.y !== 0) {
      momentumDurationY = Math.abs((newPositionY - this._drag.lastCoordinates.y) / this._velocity.y);
    }

    const momentumDuration = Math.max(momentumDurationX, momentumDurationY);

    const x = this._velocity.x * momentumDuration;
    const y = this._velocity.y * momentumDuration;

    this.translateAdd(x, y);
  }

  private changeScale(scale: number): void {
    const max = Math.max(this._scaleConfig.max, this._scaleConfig.fit);

    if (scale > max) scale = max;
    if (scale < this._scaleConfig.min) scale = this._scaleConfig.min;
    if (scale <= 1) this.dragReset();

    this._transform.scale = scale;
    this._zoomConfig.zoomChange.emit(this.scale);
  }

  private getTouchDistance = (a: Touch, b: Touch): number => {
    const x = a.pageX - b.pageX;
    const y = a.pageY - b.pageY;

    return Math.sqrt(x * x + y * y);
  };
}
