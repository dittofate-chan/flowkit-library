/* FlowKit effect — Text Pop In
 *
 * Bouncy scale-in animation. Honors:
 *   - durationFrames / durationSeconds
 *   - applyAt        ("layerStart" | "playhead")
 *   - applyMode      ("replace"    | "append")
 *   - keyColor       (0-16 label, or -1 for none)
 *   - showMarker     (boolean — adds a layer marker spanning the animation)
 */

(function () {
    var EFFECT_ID   = "text-pop-in";
    var EFFECT_NAME = "Text Pop In";
    var UNDO_LABEL  = "FlowKit · Text Pop In";

    var DEFAULT_DURATION_S = 0.42;

    var R_START  = 0.00;
    var R_OVER   = 0.43;
    var R_SETTLE = 1.00;

    var SCALE_OVER  = 115;
    var SCALE_FINAL = 100;

    function easeArr(speed, influence, dim) {
        var a = [];
        for (var d = 0; d < dim; d++) a.push(new KeyframeEase(speed, influence));
        return a;
    }
    function valArr(v, dim) {
        var a = [];
        for (var d = 0; d < dim; d++) a.push(v);
        return a;
    }
    function snap(t, frameDur) { return Math.round(t / frameDur) * frameDur; }
    function readOptions() {
        try { return ($.flowkit && $.flowkit.__effectOptions) || {}; }
        catch (e) { return {}; }
    }

    function main() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return "ERR: Open a composition first.";
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) return "ERR: Select at least one layer.";

        var opts = readOptions();
        var frameDur = comp.frameDuration;

        var totalDur;
        if (opts.durationSeconds && opts.durationSeconds > 0)      totalDur = opts.durationSeconds;
        else if (opts.durationFrames && opts.durationFrames > 0)   totalDur = opts.durationFrames * frameDur;
        else                                                        totalDur = DEFAULT_DURATION_S;

        var applyAt    = opts.applyAt   || "layerStart";
        var applyMode  = opts.applyMode || "replace";
        var keyColor   = (opts.keyColor != null && opts.keyColor >= 0) ? opts.keyColor : null;
        var showMarker = (opts.showMarker !== false);

        app.beginUndoGroup(UNDO_LABEL);
        try {
            var applied = 0;

            for (var i = 0; i < sel.length; i++) {
                var layer = sel[i];
                if (!layer.scale) continue;

                var scale = layer.scale;
                var baseScale = scale.value;
                var dim = baseScale.length || 2;
                var ratio = baseScale[0] / 100;

                var baseTime;
                if (applyAt === "playhead") baseTime = snap(comp.time, frameDur);
                else                         baseTime = layer.inPoint;

                if (applyMode === "replace") {
                    $.flowkit._removePreviousApply(layer, EFFECT_ID);
                }

                var t1 = snap(baseTime + R_START  * totalDur, frameDur);
                var t2 = snap(baseTime + R_OVER   * totalDur, frameDur);
                var t3 = snap(baseTime + R_SETTLE * totalDur, frameDur);
                if (t2 <= t1) t2 = t1 + frameDur;
                if (t3 <= t2) t3 = t2 + frameDur;

                scale.setValueAtTime(t1, valArr(0,                       dim));
                scale.setValueAtTime(t2, valArr(SCALE_OVER  * ratio,     dim));
                scale.setValueAtTime(t3, valArr(SCALE_FINAL * ratio,     dim));

                var i1 = $.flowkit._findKeyIndexAtTime(scale, t1);
                var i2 = $.flowkit._findKeyIndexAtTime(scale, t2);
                var i3 = $.flowkit._findKeyIndexAtTime(scale, t3);
                if (i1 > 0) scale.setTemporalEaseAtKey(i1, easeArr(0, 33, dim), easeArr(0, 33, dim));
                if (i2 > 0) scale.setTemporalEaseAtKey(i2, easeArr(0, 33, dim), easeArr(0, 75, dim));
                if (i3 > 0) scale.setTemporalEaseAtKey(i3, easeArr(0, 75, dim), easeArr(0, 75, dim));

                if (keyColor != null) {
                    $.flowkit._labelKeysAtTimes(scale, [t1, t2, t3], keyColor);
                }

                var markerInfo = null;
                if (showMarker) {
                    $.flowkit._addEffectMarker(layer, EFFECT_NAME, t1, t3 - t1, keyColor);
                    markerInfo = { time: t1 };
                }

                // Pass effectName so cleanup uses prefix-based marker removal
                $.flowkit._recordApply(layer, EFFECT_ID, EFFECT_NAME, {
                    keyframes: [{ prop: "Scale", times: [t1, t2, t3] }],
                    marker: markerInfo
                });

                applied++;
            }

            if (applied === 0) return "ERR: No layers had a scale property.";

            var totalFrames = Math.round(totalDur / frameDur);
            return "Applied Text Pop In to " + applied + " layer" +
                   (applied === 1 ? "" : "s") + " (" + totalFrames + " frames)";
        } catch (e) {
            return "ERR: " + (e && e.message ? e.message : String(e));
        } finally {
            app.endUndoGroup();
        }
    }

    return main();
})();
