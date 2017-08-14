/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  Directive,
  Input,
  OnInit,
  OnChanges,
  ElementRef,
  Renderer2,
  SimpleChanges
} from '@angular/core';
import {ɵgetDOM as getDom} from '@angular/platform-browser';

import {BaseFxDirective} from './base';
import {MediaMonitor} from '../../media-query/media-monitor';
import {MediaChange} from '../../media-query/media-change';
import {BreakPointX} from '../responsive/responsive-activation';

const DEFAULT_SRCSET = 'srcset';

/**
 * Directive that injects -in a container <picture> element- <source> elements with media and
 * srcset attributes.
 * <source> elemets are sorted according to the related media query : from largest to smallest
 *
 * For browsers not supporting the <picture> element, the Picturefill polyfill is still needed.
 *
 * @see https://html.spec.whatwg.org/multipage/embedded-content.html#the-picture-element
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture
 * @see https://www.html5rocks.com/en/tutorials/responsive/picture-element/
 * @see https://caniuse.com/#search=picture
 * @see http://scottjehl.github.io/picturefill/
 */
@Directive({
  selector: `
  [srcset],
  [srcset.xs], [srcset.sm], [srcset.md], [srcset.lg], [srcset.xl],
  [srcset.lt-sm], [srcset.lt-md], [srcset.lt-lg], [srcset.lt-xl],
  [srcset.gt-xs], [srcset.gt-sm], [srcset.gt-md], [srcset.gt-lg]
`
})
export class ImgSrcsetDirective extends BaseFxDirective implements OnInit, OnChanges {

  /**
   * Intercept srcset assignment so we cache the default static value.
   * When the responsive breakpoint deactivates,it is possible that fallback static
   * value (which is used to clear the deactivated value) will be used
   * (if no other breakpoints activate)
   */
  @Input('srcset')
  set srcsetBase(val) {
    this._cacheInput('srcset', val);
  }

  /* tslint:disable */
  @Input('srcset.xs')
  set srcsetXs(val) {
    this._cacheInput('srcsetXs', val);
  }

  @Input('srcset.sm')
  set srcsetSm(val) {
    this._cacheInput('srcsetSm', val);
  };

  @Input('srcset.md')
  set srcsetMd(val) {
    this._cacheInput('srcsetMd', val);
  };

  @Input('srcset.lg')
  set srcsetLg(val) {
    this._cacheInput('srcsetLg', val);
  };

  @Input('srcset.xl')
  set srcsetXl(val) {
    this._cacheInput('srcsetXl', val);
  };

  @Input('srcset.lt-sm')
  set srcsetLtSm(val) {
    this._cacheInput('srcsetLtSm', val);
  };

  @Input('srcset.lt-md')
  set srcsetLtMd(val) {
    this._cacheInput('srcsetLtMd', val);
  };

  @Input('srcset.lt-lg')
  set srcsetLtLg(val) {
    this._cacheInput('srcsetLtLg', val);
  };

  @Input('srcset.lt-xl')
  set srcsetLtXl(val) {
    this._cacheInput('srcsetLtXl', val);
  };

  @Input('srcset.gt-xs')
  set srcsetGtXs(val) {
    this._cacheInput('srcsetGtXs', val);
  };

  @Input('srcset.gt-sm')
  set srcsetGtSm(val) {
    this._cacheInput('srcsetGtSm', val);
  };

  @Input('srcset.gt-md')
  set srcsetGtMd(val) {
    this._cacheInput('srcsetGtMd', val);
  };

  @Input('srcset.gt-lg')
  set srcsetGtLg(val) {
    this._cacheInput('srcsetGtLg', val);
  };

  /* tslint:enable */
  constructor(elRef: ElementRef, renderer: Renderer2, monitor: MediaMonitor) {
    super(monitor, elRef, renderer);
  }

  /**
   * Inject <source> elements once based on the used input properties
   */
  ngOnInit() {
    // Only responsively update srcset values for stand-alone image elements
    this._listenForMediaQueryChanges(DEFAULT_SRCSET, '', (changes: MediaChange) => {
      let activatedKey = DEFAULT_SRCSET + changes.suffix
      this._updateSrcset(activatedKey)
    });

    this._configureIsolatedImg();
    this._injectSourceElements();
  }

  /**
   * Update the srcset of the relevant injected <source> elements with the new data-bound input
   * properties. <source> elements are injected once through ngOnInit
   */
  ngOnChanges(changes: SimpleChanges) {
    Object.keys(changes).forEach(key => {
      if (!changes[key].firstChange) {
        this._updateSrcset(key);
      }
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    // remove reference to dom elements to avoid memory leaks
    this._injectedSourceElements = null;
  }

  /**
   * Responsive activation is used ONLY for standalone images
   * Image tags nested in Picture containers, however, ignore responsive activations
   * as injected <sources> are used. Changes to srcset values for nested images
   * directly update the injected source elements.
   */
  protected _updateSrcset(activatedKey: string) {
    if (!this.hasPictureParent) {
      let target = this._injectedSourceElements[activatedKey];
      // If databinding is used, then the attribute is removed and
      // `ng-reflect-srcset-base` is used; so let's manually restore the attribute.
      this._renderer.setAttribute(target, DEFAULT_SRCSET, this._queryInput(activatedKey));
    } else {
      // Identify the correct source and simply update the attribute with the new value
      let target = this._injectedSourceElements[activatedKey] || this.nativeElement;
      this._renderer.setAttribute(target, DEFAULT_SRCSET, this._queryInput(activatedKey));
    }
  }

  /**
   * Inject source elements based on their related media queries from largest to smallest.
   * Keep the <img> element as the last child of the <picture> element: this necessary as the
   * browser process the children of <picture> and uses the first one with the acceptable media
   * query. <img> is defaulted to when no <source> element matches (and providing in the same time
   * backward compatibility)
   */
  protected _injectSourceElements() {
    let isBrowser = getDom().supportsDOMEvents();
    if (isBrowser && this.hasPictureParent && this._mqActivation ) {
      let breakpointsInUse = this._mqActivation.registryFromLargest;

      // If <picture><img></picture>, create a <source> elements inside the <picture> container;
      // @see https://www.html5rocks.com/en/tutorials/responsive/picture-element/
      breakpointsInUse.forEach((bpX: BreakPointX) => {
        const sourceElt = this._renderer.createElement('source');
        this._injectedSourceElements[bpX.key] = sourceElt;

        this._renderer.setAttribute(sourceElt, 'media', bpX.mediaQuery);
        this._renderer.setAttribute(sourceElt, DEFAULT_SRCSET, this._queryInput(bpX.key));
        this._renderer.insertBefore(this.parentElement, sourceElt, this.nativeElement);
      });
    }
  }

  /**
   *  If only <img> is defined with srcsets then use that as the target entry
   *  add responsively update the property srcset based on activated input value
   */
  protected _configureIsolatedImg() {
    if (!this.hasPictureParent) {
      let target = this.nativeElement;
      this._renderer.setAttribute(target, DEFAULT_SRCSET, this._queryInput(DEFAULT_SRCSET));
    }
  }

  /**
   * Does the image (with srcset usages) have a <picture> parent;
   * which is used as container for <source> element ?
   * @see https://www.html5rocks.com/en/tutorials/responsive/picture-element/
   *
   */
  protected get hasPictureParent() {
    return this.parentElement.nodeName == 'PICTURE'
  }

  /** Reference to injected source elements to be used when there is a need to update their
   * attributes. */
  private _injectedSourceElements: { [input: string]: any } = {};
}
