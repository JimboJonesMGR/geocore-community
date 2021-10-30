// 7.3.0-18-gea3dee2
/*!jQuery Knob*/
/**
 * Based on Knob, with modifications to use specifically as progress
 * 
 * Downward compatible, touchable dial
 *
 * Version: 1.2.0 (15/07/2012)
 * Requires: jQuery v1.7+
 *
 * Copyright (c) 2012 Anthony Terrien
 * Under MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
 *
 * Thanks to vor, eskimoblood, spiffistan, FabrizioC
 */
(function($) {

	/**
	 * Kontrol library
	 */
	"use strict";

	/**
	 * Definition of globals and core
	 */
	var k = {}, // kontrol
		max = Math.max,
		min = Math.min;

	k.c = {};
	k.c.d = $(document);
	k.c.t = function (e) {
		return e.originalEvent.touches.length - 1;
	};

	/**
	 * Kontrol Object
	 *
	 * Definition of an abstract UI control
	 *
	 * Each concrete component must call this one.
	 * <code>
	 * k.o.call(this);
	 * </code>
	 */
	k.o = function () {
		var s = this;

		this.o = null; // array of options
		this.$ = null; // jQuery wrapped element
		this.i = null; // mixed HTMLInputElement or array of HTMLInputElement
		this.g = null; // 2D graphics context for 'pre-rendering'
		this.v = null; // value ; mixed array or integer
		this.cv = null; // change value ; not commited value
		this.x = 0; // canvas x position
		this.y = 0; // canvas y position
		this.$c = null; // jQuery canvas element
		this.c = null; // rendered canvas context
		this.t = 0; // touches index
		this.isInit = false;
		this.fgColor = null; // main color
		this.pColor = null; // previous color
		this.dH = null; // draw hook
		this.cH = null; // change hook
		this.eH = null; // cancel hook
		this.rH = null; // release hook
		this.scale = 1; // scale factor

		this.run = function () {
			var cf = function (e, conf) {
				var k;
				for (k in conf) {
					s.o[k] = conf[k];
				}
				s.init();
				s._configure()
				 ._draw();
			};

			if(this.$.data('kontroled')) return;
			this.$.data('kontroled', true);

			this.extend();
			this.o = $.extend(
				{
					// Config
					min : this.$.data('min') || 0,
					max : this.$.data('max') || 100,
					stopper : true,
					readOnly : this.$.data('readonly'),

					// UI
					cursor : (this.$.data('cursor') === true && 30)
								|| this.$.data('cursor')
								|| 0,
					thickness : this.$.data('thickness') || 0.35,
					lineCap : this.$.data('linecap') || 'butt',
					width : this.$.data('width') || 200,
					height : this.$.data('height') || 200,
					displayInput : this.$.data('displayinput') == null || this.$.data('displayinput'),
					displayPrevious : this.$.data('displayprevious'),
					fgColor : this.$.data('fgcolor') || '#87CEEB',
					inputColor: this.$.data('inputcolor') || this.$.data('fgcolor') || '#87CEEB',
					inline : false,
					step : this.$.data('step') || 1,

					// Hooks
					draw : null, // function () {}
					change : null, // function (value) {}
					cancel : null, // function () {}
					release : null, // function (value) {}
					error : null // function () {}
				}, this.o
			);

			// routing value
			if(this.$.is('fieldset')) {

				// fieldset = array of integer
				this.v = {};
				this.i = this.$.find('input');
				this.i.each(function(k) {
					var $this = $(this);
					s.i[k] = $this;
					s.v[k] = $this.val();
					//do not bind changes until after verification that canvas
					//will work properly
				});
				this.$.find('legend').remove();

			} else {
				// input = integer
				this.i = this.$;
				this.v = this.$.val();
				(this.v == '') && (this.v = this.o.min);
				//do not bind changes until after verification that canvas
				//will work properly
			}

			(!this.o.displayInput) && this.$.hide();

			this.$c = $(document.createElement('canvas')).attr({
			  width: this.o.width,
			  height: this.o.height
			});
			
			if (typeof G_vmlCanvasManager !== 'undefined') {
			  G_vmlCanvasManager.initElement(this.$c[0]);
			}

			this.c = this.$c[0].getContext? this.$c[0].getContext('2d') : null;
			
			if (!this.c) {
				this.o.error && this.o.error();
				return;
			}
			//do the change bind
			if(this.$.is('fieldset')) {
				this.i.each(function(k) {
					$this.bind(
						'change'
						, function () {
							var val = {};
							val[k] = $this.val();
							s.val(val);
						}
					);
				});
			} else {
				this.$.bind(
						'change'
						, function () {
							s.val(s._validate(s.$.val()));
						}
					);
			}

			this.$
				.wrap($('<div style="' + (this.o.inline ? 'display:inline;' : '') +
						'width:' + this.o.width + 'px;height:' +
						this.o.height + 'px;"></div>'))
				.before(this.$c);

			this.scale = (window.devicePixelRatio || 1) /
						(
							this.c.webkitBackingStorePixelRatio ||
							this.c.mozBackingStorePixelRatio ||
							this.c.msBackingStorePixelRatio ||
							this.c.oBackingStorePixelRatio ||
							this.c.backingStorePixelRatio || 1
						);
			if (this.scale !== 1) {
				this.$c[0].width = this.$c[0].width * this.scale;
				this.$c[0].height = this.$c[0].height * this.scale;
				this.$c.width(this.o.width);
				this.$c.height(this.o.height);
			}

			if (this.v instanceof Object) {
				this.cv = {};
				this.copy(this.v, this.cv);
			} else {
				this.cv = this.v;
			}

			this.$
				.bind("configure", cf)
				.parent()
				.bind("configure", cf);

			this._listen()
				._configure()
				._xy()
				.init();

			this.isInit = true;

			this._draw();

			return this;
		};

		this._draw = function () {

			// canvas pre-rendering
			var d = true;

			s.g = s.c;

			s.clear();

			s.dH
			&& (d = s.dH());

			(d !== false) && s.draw();

		};

		this._touch = function (e) {
			//This is PROGRESS only, no listening to inputs
			return this;
		};

		this._mouse = function (e) {
			//This is PROGRESS only, no listening to inputs
			return this;
		};

		this._xy = function () {
			var o = this.$c.offset();
			this.x = o.left;
			this.y = o.top;
			return this;
		};

		this._listen = function () {
			//This is PROGRESS only, no listening to inputs
			return this;
		};

		this._configure = function () {

			// Hooks
			if (this.o.draw) this.dH = this.o.draw;
			if (this.o.change) this.cH = this.o.change;
			if (this.o.cancel) this.eH = this.o.cancel;
			if (this.o.release) this.rH = this.o.release;

			if (this.o.displayPrevious) {
				this.pColor = this.h2rgba(this.o.fgColor, "0.4");
				this.fgColor = this.h2rgba(this.o.fgColor, "0.6");
			} else {
				this.fgColor = this.o.fgColor;
			}

			return this;
		};

		this._clear = function () {
			this.$c[0].width = this.$c[0].width;
		};

		this._validate = function(v) {
			return (~~ (((v < 0) ? -0.5 : 0.5) + (v/this.o.step))) * this.o.step;
		};

		// Abstract methods
		this.listen = function () {}; // on start, one time
		this.extend = function () {}; // each time configure triggered
		this.init = function () {}; // each time configure triggered
		this.change = function (v) {}; // on change
		this.val = function (v) {}; // on release
		this.xy2val = function (x, y) {}; //
		this.draw = function () {}; // on change / on release
		this.clear = function () { this._clear(); };

		// Utils
		this.h2rgba = function (h, a) {
			var rgb;
			h = h.substring(1,7);
			rgb = [parseInt(h.substring(0,2),16)
				   ,parseInt(h.substring(2,4),16)
				   ,parseInt(h.substring(4,6),16)];
			return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
		};

		this.copy = function (f, t) {
			for (var i in f) { t[i] = f[i]; }
		};
	};


	/**
	 * k.Dial
	 */
	k.Dial = function () {
		k.o.call(this);

		this.startAngle = null;
		this.xy = null;
		this.radius = null;
		this.lineWidth = null;
		this.cursorExt = null;
		this.w2 = null;
		this.PI2 = 2*Math.PI;

		this.extend = function () {
			this.o = $.extend(
				{
					bgColor : this.$.data('bgcolor') || '#EEEEEE',
					angleOffset : this.$.data('angleoffset') || 0,
					angleArc : this.$.data('anglearc') || 360,
					inline : true
				}, this.o
			);
		};

		this.val = function (v) {
			if (null != v) {
				this.cv = this.o.stopper ? max(min(v, this.o.max), this.o.min) : v;
				this.v = this.cv;
				this.$.val(this.v+'%');
				this._draw();
			} else {
				return this.v;
			}
		};

		this.xy2val = function (x, y) {
			var a, ret;

			a = Math.atan2(
						x - (this.x + this.w2)
						, - (y - this.y - this.w2)
					) - this.angleOffset;

			if(this.angleArc != this.PI2 && (a < 0) && (a > -0.5)) {
				// if isset angleArc option, set to min if .5 under min
				a = 0;
			} else if (a < 0) {
				a += this.PI2;
			}

			ret = ~~ (0.5 + (a * (this.o.max - this.o.min) / this.angleArc))
					+ this.o.min;

			this.o.stopper
			&& (ret = max(min(ret, this.o.max), this.o.min));

			return ret;
		};

		this.listen = function () {
			//This is PROGRESS only, no listening to inputs
		};

		this.init = function () {

			if (
				this.v < this.o.min
				|| this.v > this.o.max
			) this.v = this.o.min;

			this.$.val(this.v);
			this.w2 = this.o.width / 2;
			this.cursorExt = this.o.cursor / 100;
			this.xy = this.w2 * this.scale;
			this.lineWidth = this.xy * this.o.thickness;
			this.lineCap = this.o.lineCap;
			this.radius = this.xy - this.lineWidth / 2;

			this.o.angleOffset
			&& (this.o.angleOffset = isNaN(this.o.angleOffset) ? 0 : this.o.angleOffset);

			this.o.angleArc
			&& (this.o.angleArc = isNaN(this.o.angleArc) ? this.PI2 : this.o.angleArc);

			// deg to rad
			this.angleOffset = this.o.angleOffset * Math.PI / 180;
			this.angleArc = this.o.angleArc * Math.PI / 180;

			// compute start and end angles
			this.startAngle = 1.5 * Math.PI + this.angleOffset;
			this.endAngle = 1.5 * Math.PI + this.angleOffset + this.angleArc;

			this.o.displayInput
				&& this.i.css({
						'width' : ((this.o.width / 2 + 4) >> 0) + 'px'
						,'height' : ((this.o.width / 3) >> 0) + 'px'
						,'position' : 'absolute'
						,'vertical-align' : 'middle'
						,'margin-top' : ((this.o.width / 3) >> 0) + 'px'
						,'margin-left' : '-' + ((this.o.width * 3 / 4 + 2) >> 0) + 'px'
						,'border' : 0
						,'background' : 'none'
						,'font' : 'bold 1em Arial'
						,'text-align' : 'center'
						,'color' : this.o.inputColor || this.o.fgColor
						,'padding' : '0px'
						,'-webkit-appearance': 'none'
						})
				|| this.i.css({
						'width' : '0px'
						,'visibility' : 'hidden'
						});
		};

		this.change = function (v) {
			this.cv = v;
			this.$.val(v);
		};

		this.angle = function (v) {
			return (v - this.o.min) * this.angleArc / (this.o.max - this.o.min);
		};

		this.draw = function () {

			var c = this.g,				 // context
				a = this.angle(this.cv)	// Angle
				, sat = this.startAngle	 // Start angle
				, eat = sat + a			 // End angle
				, sa, ea					// Previous angles
				, r = 1;

			c.lineWidth = this.lineWidth;

			c.lineCap = this.lineCap;

			this.o.cursor
				&& (sat = eat - this.cursorExt)
				&& (eat = eat + this.cursorExt);

			c.beginPath();
				c.strokeStyle = this.o.bgColor;
				c.arc(this.xy, this.xy, this.radius, this.endAngle, this.startAngle, true);
			c.stroke();

			if (this.o.displayPrevious) {
				ea = this.startAngle + this.angle(this.v);
				sa = this.startAngle;
				this.o.cursor
					&& (sa = ea - this.cursorExt)
					&& (ea = ea + this.cursorExt);

				c.beginPath();
					c.strokeStyle = this.pColor;
					c.arc(this.xy, this.xy, this.radius, sa, ea, false);
				c.stroke();
				r = (this.cv == this.v);
			}

			c.beginPath();
				c.strokeStyle = r ? this.o.fgColor : this.fgColor ;
				c.arc(this.xy, this.xy, this.radius, sat, eat, false);
			c.stroke();
		};

		this.cancel = function () {
			this.val(this.v);
		};
	};

	$.fn.gjProgress = function (o) {
		return this.each(
			function () {
				var d = new k.Dial();
				d.o = o;
				d.$ = $(this);
				d.run();
			}
		).parent();
	};

})(jQuery);