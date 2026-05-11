/* FlowKit effect — Letter Fade Out
 *
 * Cinematic outro for text layers. Letters rise slightly, scale down,
 * and fade out, sequentially from left to right via Range Selector End
 * sweeping 0% → 100%.
 *
 * Records both the animator (for cleanup) AND the animator's keyframe
 * times (so Stretch/Reverse can reach into the Range Selector's End).
 */

(function () {
    var EFFECT_ID   = "letter-fade-out";
    var EFFECT_NAME = "Letter Fade Out";
    var UNDO_LABEL  = "FlowKit · Letter Fade Out";

    var DEFAULT_DURATION_S = 0.8;

    var LIFT_PIXELS  = 50;
    var SCALE_FINAL  = 90;
    var ROTATE_DEG   = 0;

    function snap(t, frameDur) { return Math.round(t / frameDur) * frameDur; }
    function readOptions() {
        try { return ($.flowkit && $.flowkit.__effectOptions) || {}; }
        catch (e) { return {}; }
    }
    function easeArr(speed, influence, dim) {
        var a = [];
        for (var d = 0; d < dim; d++) a.push(new KeyframeEase(speed, influence));
        return a;
    }

    function main() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return "ERR: Open a composition first.";
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) return "ERR: Select a text layer.";

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
            var skipped = 0;

            for (var i = 0; i < sel.length; i++) {
                var layer = sel[i];

                if (!(layer instanceof TextLayer)) {
                    skipped++;
                    continue;
                }

                if (applyMode === "replace") {
                    $.flowkit._removePreviousApply(layer, EFFECT_ID);
                }

                // Outro positioning: "layerStart" = layer.outPoint - duration
                var baseTime;
                if (applyAt === "playhead") baseTime = snap(comp.time, frameDur);
                else                         baseTime = snap(layer.outPoint - totalDur, frameDur);

                var t1 = snap(baseTime, frameDur);
                var t2 = snap(baseTime + totalDur, frameDur);
                if (t2 <= t1) t2 = t1 + frameDur;

                // Add the text animator
                var textProp = layer.property("ADBE Text Properties");
                var animatorsGroup = textProp.property("ADBE Text Animators");
                var animator = animatorsGroup.addProperty("ADBE Text Animator");

                var uniqueId = (Date.now ? Date.now() : new Date().getTime()).toString(36);
                var animatorName = "FlowKit Outro " + uniqueId;
                animator.name = animatorName;

                // Explicitly add the Range Selector — scripting doesn't auto-create it
                var selectorsGroup = animator.property("ADBE Text Selectors");
                if (selectorsGroup.numProperties === 0) {
                    try {
                        selectorsGroup.addProperty("ADBE Text Selector");
                    } catch (eSel) {
                        try { selectorsGroup.addProperty("ADBE Text Range Selector"); }
                        catch (eSel2) {
                            return "ERR: Could not create Range Selector. AE version may differ.";
                        }
                    }
                }
                var rangeSel = selectorsGroup.property(1);

                // End-state properties
                var animProps = animator.property("ADBE Text Animator Properties");
                try {
                    animProps.addProperty("ADBE Text Position 3D").setValue([0, -LIFT_PIXELS, 0]);
                } catch (e) {}
                try {
                    animProps.addProperty("ADBE Text Opacity").setValue(0);
                } catch (e) {}
                try {
                    animProps.addProperty("ADBE Text Scale 3D").setValue([SCALE_FINAL, SCALE_FINAL, 100]);
                } catch (e) {}
                if (ROTATE_DEG !== 0) {
                    try { animProps.addProperty("ADBE Text Rotation Z").setValue(ROTATE_DEG); }
                    catch (e) {}
                }

                // Animate Range Selector End from 0% → 100%
                var endProp = rangeSel.property("ADBE Text Percent End");
                endProp.setValueAtTime(t1, 0);
                endProp.setValueAtTime(t2, 100);

                var i1 = $.flowkit._findKeyIndexAtTime(endProp, t1);
                var i2 = $.flowkit._findKeyIndexAtTime(endProp, t2);
                if (i1 > 0) endProp.setTemporalEaseAtKey(i1, easeArr(0, 33, 1), easeArr(0, 33, 1));
                if (i2 > 0) endProp.setTemporalEaseAtKey(i2, easeArr(0, 75, 1), easeArr(0, 75, 1));

                if (keyColor != null) {
                    $.flowkit._labelKeysAtTimes(endProp, [t1, t2], keyColor);
                }

                var markerInfo = null;
                if (showMarker) {
                    $.flowkit._addEffectMarker(layer, EFFECT_NAME, t1, t2 - t1, keyColor);
                    markerInfo = { time: t1 };
                }

                // Record both animator (for cleanup) AND the End property's
                // keyframe times (so Stretch/Reverse can reach them)
                $.flowkit._recordApply(layer, EFFECT_ID, EFFECT_NAME, {
                    animators: [animatorName],
                    animatorKeyframes: [{
                        animator: animatorName,
                        selectorIdx: 1,
                        selectorProp: "ADBE Text Percent End",
                        times: [t1, t2]
                    }],
                    marker: markerInfo
                });

                applied++;
            }

            if (applied === 0 && skipped > 0) return "ERR: Letter Fade Out works on text layers only.";
            if (applied === 0)                return "ERR: Select a text layer.";

            var totalFrames = Math.round(totalDur / frameDur);
            var msg = "Applied Letter Fade Out to " + applied + " layer" +
                      (applied === 1 ? "" : "s") + " (" + totalFrames + " frames)";
            if (skipped > 0) msg += " · skipped " + skipped + " non-text";
            return msg;
        } catch (e) {
            return "ERR: " + (e && e.message ? e.message : String(e));
        } finally {
            app.endUndoGroup();
        }
    }

    return main();
})();
