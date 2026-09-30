class HJ_ISIS extends BaseInstrument {
    constructor() {
        super();
        this.PX_PER_DEG = 7.2;
        this.TAPE_SPACING = 40;

        // Instrument State Variables
        this.pitch = 0;
        this.roll = 0;
        this.heading = 0;
        this.qnh = 1013;
        this.airspeed = 0;
        this.altitude = 0;
        this.isStdSet = false;
        this.isOverspeed = false;
        this.machVal = 0;
        this.slip = 0;

        // Slip box tuning
        this.SLIP_GAIN = 6;
        this.SLIP_MAX_PX = 30;
        this.SLIP_DEADBAND = 0.1;
        this.SLIP_SMOOTHING = 0.1;
        this.slipSmoothed = 0;
    }

    get templateID() {
        return "HJ_ISIS_Template";
    }

    connectedCallback() {
        super.connectedCallback();

        // Cache DOM elements

        this.pitchLadderEl = this.querySelector('#pitchLadder');
        this.pitchRollGroupEl = this.querySelector('#pitchRollGroup');
        this.headingTrackEl = this.querySelector('#headingTrack');
        this.airspeedScaleTrackEl = this.querySelector('#airspeedScaleTrack');
        this.airspeedTapeTrackEl = this.querySelector('#airspeedTapeTrack');
        this.airspeedHundredsTrackEl = this.querySelector('#airspeedHundredsTrack');
        this.altitudeScaleTrackEl = this.querySelector('#altitudeScaleTrack');
        this.altitudeTapeTrackEl = this.querySelector('#altitudeTapeTrack');
        this.altitudeHundredsTrackEl = this.querySelector('#altitudeHundredsTrack');

        this.machElement = this.querySelector('#machValue');
        this.stdLabel = this.querySelector('#stdLabel');
        this.qnhValueElement = this.querySelector('#qnhValue');
        this.groundEarth = this.querySelector('#groundEarth');
        this.rollPointer = this.querySelector('#rollPointerContainer');
      this.slipBox = this.querySelector('#slipBox');

    }

    // Called automatically every visual frame by MSFS
    Update() {
        super.Update();

        // Fetch variables natively via SimVar
        this.pitch = -SimVar.GetSimVarValue("PLANE PITCH DEGREES", "Degrees");
        this.roll = SimVar.GetSimVarValue("PLANE BANK DEGREES", "Degrees");
        this.heading = SimVar.GetSimVarValue("PLANE HEADING DEGREES MAGNETIC", "Degrees");
        this.qnh = SimVar.GetSimVarValue("KOHLSMAN SETTING MB:3", "Millibars");
        this.airspeed = SimVar.GetSimVarValue("AIRSPEED INDICATED", "Knots");
        this.altitude = SimVar.GetSimVarValue("INDICATED ALTITUDE:3", "Feet");
        this.isStdSet = SimVar.GetSimVarValue("KOHLSMAN SETTING STD:3", "Bool");
        this.machVal = SimVar.GetSimVarValue("AIRSPEED MACH", "Mach");
        this.slip = SimVar.GetSimVarValue("INCIDENCE BETA", "Degrees");

        this.renderAll();
    }

    buildPitchLadder() {
        const NS = "http://www.w3.org/2000/svg";
        const CX = 177.5, CY = 192;
        this.pitchLadderEl.innerHTML = '';

        for (let a = -90; a <= 90; a += 2.5) {
            if (a === 0) continue;
            const absAngle = Math.abs(a);
            let width, height, showLabel = false;

            if (absAngle % 10 === 0)     { width = 128; height = 3; showLabel = true; }
            else if (absAngle % 5 === 0) { width = 72;  height = 3; }
            else                         { width = 38;  height = 2; }

            const y = CY - a * this.PX_PER_DEG;

            const bar = document.createElementNS(NS, "rect");
            bar.setAttribute("x", CX - width / 2);
            bar.setAttribute("y", y - height / 2);
            bar.setAttribute("width", width);
            bar.setAttribute("height", height);
            bar.setAttribute("fill", "white");
            this.pitchLadderEl.appendChild(bar);

            if (showLabel) {
                [["end", CX - 68], ["start", CX + 68]].forEach(([anchor, x]) => {
                    const t = document.createElementNS(NS, "text");
                    t.setAttribute("x", x);
                    t.setAttribute("y", y + 8);
                    t.setAttribute("fill", "white");
                    t.setAttribute("font-family", "'B612 Mono', monospace");
                    t.setAttribute("font-size", "24");
                    t.setAttribute("text-anchor", anchor);
                    t.textContent = absAngle;
                    this.pitchLadderEl.appendChild(t);
                });
            }
        }
    }

    buildHeadingTrack() {
        this.headingTrackEl.innerHTML = '';
        const firstTick = Math.floor(this.heading / 5) * 5;
        const headingPoles = {0: "N", 18: "S", 9: "W", 27: "E"};

        for (let tickHdg = firstTick - 50; tickHdg <= firstTick + 55; tickHdg += 5) {
            const hdg = ((tickHdg % 360) + 360) % 360;
            const isMajor = hdg % 10 === 0;
            const delta = tickHdg - this.heading;

            const tick = document.createElement('div');
            tick.className = 'heading-tick';
            tick.style.transform = `translateX(${delta * this.PX_PER_DEG}px)`;

            const line = document.createElement('div');
            line.style.width = '3px';
            line.style.height = `${isMajor ? 12 : 8}px`;
            line.style.backgroundColor = 'white';
            tick.appendChild(line);

            if (isMajor) {
                const label = document.createElement('span');
                const numberHdg = parseInt(Math.round(hdg / 10).toString().padStart(2, '0'));
                label.className = 'heading-label';
                label.textContent = headingPoles[numberHdg] || numberHdg;
                tick.appendChild(label);
            }
            this.headingTrackEl.appendChild(tick);
        }
    }

    buildAirspeedScale() {
        this.airspeedScaleTrackEl.innerHTML = '';
        const PX_PER_KNOT = 6.5;
        const v = Math.max(40, this.airspeed);
        const minSpd = Math.floor((v - 80) / 10) * 10;
        const maxSpd = Math.ceil((v + 80) / 10) * 10;

        for (let spd = minSpd; spd <= maxSpd; spd += 10) {
            if (spd < 40) continue;
            const deltaSpd = spd - v;
            const y = 224 - (deltaSpd * PX_PER_KNOT);

            const tick = document.createElement('div');
            const tick2 = document.createElement('div');

            if (spd > 280) {
                tick.className = 'overspeed-tick';
                tick.style.top = `${y}px`;
                tick.style.width = spd % 20 === 0 ? '0px' : '12px';
                tick.style.height = '130px';
                this.airspeedScaleTrackEl.appendChild(tick);
            }

            tick2.className = 'airspeed-tick';
            tick2.style.top = `${y}px`;
            tick2.style.width = spd % 20 === 0 ? '0px' : '18px';
            tick2.style.height = '2px';
            this.airspeedScaleTrackEl.appendChild(tick2);

            if (spd % 20 === 0) {
                const label = document.createElement('span');
                label.className = 'airspeed-label';
                label.style.top = `${y}px`;
                label.style.transform = 'translateY(-50%)';
                label.textContent = spd.toString();
                this.airspeedScaleTrackEl.appendChild(label);
            }
        }
    }

    buildAirspeedTape() {
        const v = Math.max(40, this.airspeed);
        this.airspeedTapeTrackEl.innerHTML = '';
        const centerBase = Math.floor(v);

        for (let val = centerBase - 3; val <= centerBase + 3; val++) {
            if (val < 40) continue;
            const actualY = 65 - (val - v) * this.TAPE_SPACING;
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", "56");
            text.setAttribute("y", actualY);
            text.setAttribute("font-family", "'B612 Mono', monospace");
            text.setAttribute("class", "svg-text-42");
            this.isOverspeed = (val >= 271);
            text.setAttribute("fill", this.isOverspeed ? "red" : "white");
            text.setAttribute("text-anchor", "start");
            text.textContent = (Math.abs(val) % 10).toString();
            this.airspeedTapeTrackEl.appendChild(text);
        }

        this.airspeedHundredsTrackEl.innerHTML = '';
        const rem = ((v % 10) + 10) % 10;
        let progress = rem >= 9 ? rem - 9 : 0;
        const curr_h = Math.floor(v / 10);

        const createText = (val, y) => {
            if (val < 4) return;
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", "56");
            text.setAttribute("y", y);
            text.setAttribute("fill", (this.isOverspeed && this.airspeed >= 271) ? "red" : "white");
            text.setAttribute("font-family", "'B612 Mono', monospace");
            text.setAttribute("class", "svg-text-42");
            text.setAttribute("text-anchor", "end");
            text.textContent = val.toString();
            this.airspeedHundredsTrackEl.appendChild(text);
        };

        createText(curr_h, 65 + progress * 50);
        createText(curr_h + 1, 15 + progress * 50);
    }

    buildAltitudeScale() {
        this.altitudeScaleTrackEl.innerHTML = '';
        const PX_PER_FT = 0.37;
        const minScaleAlt = Math.floor((this.altitude - 800) / 100) * 100;
        const maxScaleAlt = Math.ceil((this.altitude + 800) / 100) * 100;

        for (let alt = minScaleAlt; alt <= maxScaleAlt; alt += 100) {
            const is500 = alt % 500 === 0;
            const is1000 = alt % 1000 === 0;
            const y = 238 - ((alt - this.altitude) * PX_PER_FT);

            const tick = document.createElement('div');
            tick.className = 'altitude-tick';
            tick.style.top = `${y}px`;
            tick.style.width = (is500 || is1000) ? '0px' : '18px';
            tick.style.height = '2px';
            this.altitudeScaleTrackEl.appendChild(tick);

            if (is500 || is1000) {
                const label = document.createElement('span');
                label.className = 'altitude-label';
                label.style.top = `${y}px`;
                label.style.transform = 'translateY(-50%)';
                label.textContent = is1000 ? "000" : "500";
                this.altitudeScaleTrackEl.appendChild(label);
            }
        }
    }

    buildAltitudeTape() {
        this.altitudeTapeTrackEl.innerHTML = '';
        const centerBase = Math.floor(this.altitude / 20) * 20;

        for (let val = centerBase - 60; val <= centerBase + 60; val += 20) {
            const actualY = 70 - ((val - this.altitude) / 20) * this.TAPE_SPACING;
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", "75");
            text.setAttribute("y", actualY - 8);
            text.setAttribute("fill", "white");
            text.setAttribute("font-family", "'B612 Mono', monospace");
            text.setAttribute("font-size", "32");
            text.setAttribute("text-anchor", "start");
            text.textContent = (Math.abs(val) % 100).toString().padStart(2, '0');
            this.altitudeTapeTrackEl.appendChild(text);
        }

        this.altitudeHundredsTrackEl.innerHTML = '';
        const abs_v = Math.abs(this.altitude);
        const sign = this.altitude < 0 ? -1 : 1;
        const rem = abs_v % 100;
        let progress = rem >= 80 ? (rem - 80) / 20 : 0;
        const curr_h = Math.trunc(abs_v / 100) * sign;

        const createText = (val, y) => {
            let str = val === 0 ? (this.altitude < 0 ? "-" : "") : val.toString();
            if (str === "") return;
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", "73");
            text.setAttribute("y", y);
            text.setAttribute("fill", "white");
            text.setAttribute("font-family", "'B612 Mono', monospace");
          text.setAttribute("class", "svg-text-40");
            text.setAttribute("text-anchor", "end");
            text.textContent = str;
            this.altitudeHundredsTrackEl.appendChild(text);
        };

        createText(curr_h, 65 + progress * 50 * sign);
        createText(curr_h + 1 * sign, 65 + (-50 * sign) + progress * 50 * sign);
    }

    populateData() {
            this.stdLabel.textContent = this.qnh.toFixed(2) == 1013.25 ? `STD` : "PUSH STD";

            this.qnhValueElement.innerHTML = this.isStdSet ? `STD&nbsp;&nbsp;` : `${Math.round(this.qnh)}HP`;

            this.machElement.textContent = this.machVal >= 0.50
                ? (this.machVal >= 1 ? `M${this.machVal.toFixed(2)}` : `M.${this.machVal.toFixed(2).slice(2)}`)
                : `M.`;
        }

    updateAttitude() {
        this.groundEarth.style.transform = `rotate(${this.roll}deg) translateY(${this.pitch * this.PX_PER_DEG}px)`;
        this.pitchRollGroupEl.setAttribute(
            "transform",
            `rotate(${this.roll} 177.5 192) translate(0 ${this.pitch * this.PX_PER_DEG})`
        );
        this.rollPointer.style.transform = `rotate(${-this.roll}deg)`;

        const gain = this.SLIP_GAIN;

        let target = Math.abs(this.slip) < this.SLIP_DEADBAND ? 0 : this.slip;
        this.slipSmoothed += (target - this.slipSmoothed) * this.SLIP_SMOOTHING;

        const slipPx = Math.max(-this.SLIP_MAX_PX, Math.min(this.SLIP_MAX_PX, this.slipSmoothed * gain));
        this.slipBox.style.transform = `translateX(${slipPx}px)`;
    }

    renderAll() {
      this.buildPitchLadder();
        this.buildHeadingTrack();
        this.buildAirspeedScale();
        this.buildAirspeedTape();
        this.buildAltitudeScale();
        this.buildAltitudeTape();
        this.populateData();
        this.updateAttitude();
    }
}

// Register the custom instrument with the MSFS UI Engine
registerInstrument("hj-isis", HJ_ISIS);
