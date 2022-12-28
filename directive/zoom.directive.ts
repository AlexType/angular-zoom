import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import isRequired from '@guru/utils/decorators/is-required.decorator';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { fromEvent, merge, Observable, Subscription } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

import { Coordinates } from '../models/zoom.models';
import { ZoomService } from '../service/zoom.service';

@UntilDestroy()
@Directive({
  selector: '[guZoom]',
  providers: [ZoomService]
})
export class GuZoomDirective implements OnInit, OnDestroy {
  @isRequired @Input() zoomContainerEl: HTMLElement;
  @isRequired @Input() zoomDragEl: HTMLElement;
  @Input() zoomDuration: number = 300;
  @Input() set zoomDisabled(disabled: boolean) {
    this._disabled = disabled;

    if (disabled) this.unsubscribe();
    else this.tryToSubscribe();
  }

  @Output() dragend: EventEmitter<void> = new EventEmitter<void>();
  @Output() dragstart: EventEmitter<void> = new EventEmitter<void>();
  @Output() zoomChange: EventEmitter<number> = new EventEmitter<number>();

  private _loaded = false;
  private _disabled = false;
  private _imageEl: HTMLElement;
  private _subscription: Subscription = null;
  private _dblTap = {
    count: 0,
    delay: 200,
    status: false,
    timeoutId: null,
  };

  constructor(private readonly _el: ElementRef<HTMLElement>, private readonly _zoomService: ZoomService) {
    this._imageEl = this._el.nativeElement;
  }

  ngOnInit(): void {
    fromEvent(this._imageEl, 'load').pipe(
      tap(() => this._loaded = true),
      tap(() => this.tryToSubscribe()),
      untilDestroyed(this)
    ).subscribe();
  }

  ngOnDestroy(): void {
    clearTimeout(this._dblTap.timeoutId);
  }

  private tryToSubscribe() {
    if (this._disabled || this._subscription || !this._loaded) {
      return;
    }

    this._zoomService.init({
      zoomChange: this.zoomChange,
      onDragReset: () => this.zoomDragEl.style.transitionDuration = `${this.zoomDuration}ms`
    });

    this.zoomDragEl.style.transition = `${this.zoomDuration}ms ease`;
    this._imageEl.style.transition = `${this.zoomDuration}ms ease`;
    this.zoomDragEl.style.willChange = 'transform';

    this.subscribe();
    this.setFitZoom();
  }

  private setFitZoom(): void {
    let fit = Math.max(this.zoomContainerEl.offsetHeight / this._imageEl.offsetHeight, this.zoomContainerEl.offsetWidth / this._imageEl.offsetWidth);

    if (fit === 1) {
      fit = 2;
    }

    this._zoomService.fitZoom = fit;
  }

  private subscribe(): void {
    this._subscription = merge(
      this.touchesZoomEvent(),
      this.mousewheelEvent(),
      this.dragStartEvent(),
      this.dragMoveEvent(),
      this.dblClickEvent(),
      this.dragEndEvent(),
    ).pipe(
      tap(() => this.update()),
      untilDestroyed(this)
    ).subscribe();
  }

  private unsubscribe(): void {
    this._subscription?.unsubscribe();
    this._subscription = null;
  }

  private dblClickEvent(): Observable<Event> {
    return fromEvent(this._imageEl, 'click').pipe(
      tap(() => {
        this._dblTap.count += 1;
        clearTimeout(this._dblTap.timeoutId);
        this._dblTap.timeoutId = setTimeout(() => this._dblTap.count = 0, this._dblTap.delay);
      }),
      filter(() => this._dblTap.count === 2),
      tap(() => {
        this._dblTap.count = 0;
        this._dblTap.status = !this._dblTap.status;

        if (this._dblTap.status && this._zoomService.scale === 1) {
          this._zoomService.zoomToFit();
        } else {
          this._zoomService.zoomToInitial();
          this._dblTap.status = false;
        }

        clearTimeout(this._dblTap.timeoutId);
      }));
  }

  private mousewheelEvent(): Observable<WheelEvent> {
    return fromEvent(this.zoomContainerEl, 'mousewheel')
      .pipe(
        tap((e: WheelEvent) => {
          this.stopEvent(e);

          if (e.shiftKey) {
            this._zoomService.translateAdd(-e.deltaY, -e.deltaX, true);
            return;
          } else if (!e.ctrlKey && !e.metaKey) {
            this._zoomService.translateAdd(-e.deltaX, -e.deltaY, true);
            return;
          }

          this._zoomService.zoomWithStep(-e.deltaY / 200);
        })
      );
  }

  private dragStartEvent(): Observable<Coordinates> {
    return merge(
      fromEvent(this.zoomContainerEl, 'touchstart')
        .pipe(
          filter((e: TouchEvent) => e.touches.length === 1),
          map(({ touches }: TouchEvent) => ({ x: touches[0].clientX, y: touches[0].clientY }))
        ),
      fromEvent(this.zoomContainerEl, 'mousedown').pipe(map((e: MouseEvent) => ({ x: e.clientX, y: e.clientY })))
    ).pipe(
      filter(() => this._zoomService.scale > 1),
      tap(({ x, y }: Coordinates) => {
        this.zoomDragEl.style.transitionDuration = '0s';
        this._zoomService.dragStart(x, y);
        this.dragstart.emit();
      })
    );
  }

  private dragMoveEvent(): Observable<Coordinates> {
    return merge(
      fromEvent(this.zoomContainerEl, 'touchmove')
        .pipe(
          filter((e: TouchEvent) => e.touches.length === 1),
          map(({ touches }: TouchEvent) => ({ x: touches[0].clientX, y: touches[0].clientY })),
        ),
      fromEvent(this.zoomContainerEl, 'mousemove')
        .pipe(
          filter(() => this._zoomService.dragging),
          tap((e: MouseEvent) => this.stopEvent(e)),
          map((e: MouseEvent) => ({ x: e.clientX, y: e.clientY }))
        ))
      .pipe(
        filter(() => this._zoomService.dragging),
        tap(({ x, y }: Coordinates) => {
          this.zoomContainerEl.style.cursor = 'move';
          this._zoomService.calculateVelocity(x, y);
          this._zoomService.dragMove(x, y);
        })
      );
  }

  private dragEndEvent(): Observable<Event> {
    return merge(
      fromEvent(this.zoomContainerEl, 'mouseup'),
      fromEvent(this.zoomContainerEl, 'mouseleave'),
      fromEvent(this.zoomContainerEl, 'touchend').pipe(tap(() => {
        this._zoomService.touchesReset();
        this._imageEl.style.transitionDuration = `${this.zoomDuration}ms`;
      }))
    ).pipe(
      filter(() => this._zoomService.dragging),
      tap(() => {
        this.zoomDragEl.style.transitionDuration = `${this.zoomDuration}ms`;
        this.zoomContainerEl.style.cursor = 'default';
        this._zoomService.dragEnd(this.zoomDuration);
        this.dragend.emit();
      })
    );
  }

  private touchesZoomEvent(): Observable<TouchEvent> {
    return fromEvent(this.zoomContainerEl, 'touchmove')
      .pipe(
        filter((e: TouchEvent) => e.touches.length >= 2),
        tap((e: TouchEvent) => {
          this.stopEvent(e);

          this._imageEl.style.transitionDuration = '0s';
          this._zoomService.touchZoom(e.touches);
        })
      );
  }

  private update(): void {
    this._zoomService.updateAvailableAxis(this.zoomContainerEl.offsetWidth, this.zoomContainerEl.offsetHeight, this._imageEl.offsetWidth, this._imageEl.offsetHeight);
    this._zoomService.fixOffsetExceeded(this.zoomContainerEl.clientWidth, this.zoomContainerEl.clientHeight, this._imageEl.clientWidth, this._imageEl.clientHeight);

    this._imageEl.style.transform = `scale(${this._zoomService.scale})`;
    this.zoomDragEl.style.transform = `translate3d(${this._zoomService.translateX}px, ${this._zoomService.translateY}px, 0)`;
  }

  private stopEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }
}
