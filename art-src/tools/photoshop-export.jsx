// Suture & Steel — Photoshop export script (ART-0042). File ▸ Scripts ▸ Browse… and pick this file
// (or record it into an Action so it sits on a key). Exports the active document the same way for
// every artist:
//   * a flattened duplicate, converted to 8-bit sRGB, saved as a PNG-24 with transparency
//   * at the master resolution (npm run art:export makes the ship size, ART-0034)
//   * into art-src/export/<category>/…, named per the naming rule (ART-0031)
//   * sprite frames: every top-level layer or group named "frame: <name>" is exported on its own
// Name the document "<category>--<name>.psd" (sprites: "sprites-<sheet>--<name>.psd"), e.g.
// "backdrops--ch1-hospice-ward-night.psd" or "sprites-fx--splatter-5.psd".
#target photoshop
(function () {
  var CATEGORIES = { backdrops: 1, portraits: 1, sprites: 1, ui: 1, luts: 1 };
  var NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*(@[1-4]x)?$/;

  function kebab(s) {
    return s.replace(/^\s+|\s+$/g, '').replace(/[^A-Za-z0-9@]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').toLowerCase();
  }

  function findRepo(folder) {
    var f = folder;
    while (f && f.parent) {
      if (Folder(f + '/art-src').exists && File(f + '/package.json').exists) return f;
      f = f.parent;
    }
    throw new Error('Could not find the repository (a folder holding art-src/ and package.json) above ' + folder.fsName);
  }

  function target(doc) {
    var base = doc.name.replace(/\.[^.]+$/, '');
    var m = base.match(/^([a-z]+)(?:-([a-z0-9]+))?--(.+)$/);
    if (!m) throw new Error('Name the document <category>--<name>.psd (sprites: sprites-<sheet>--<name>.psd)');
    var category = m[1];
    var sheet = m[2] || '';
    var name = kebab(m[3]);
    if (!CATEGORIES[category]) throw new Error('Unknown category "' + category + '"');
    if (category === 'sprites' && !sheet) throw new Error('Sprites need a sheet: sprites-<sheet>--<name>.psd');
    if (!NAME_RE.test(name)) throw new Error('"' + name + '" breaks the naming rule (lowercase kebab-case, optional @2x)');
    var repo = findRepo(doc.path);
    var folder = Folder(repo + '/art-src/export/' + category + (sheet ? '/' + sheet : ''));
    if (!folder.exists) folder.create();
    return { folder: folder, name: name };
  }

  function exportPng(doc, file) {
    var dup = doc.duplicate(file.name, true); // merged duplicate
    try {
      if (dup.mode !== DocumentMode.RGB) dup.changeMode(ChangeMode.RGB);
      if (dup.bitsPerChannel !== BitsPerChannelType.EIGHT) dup.bitsPerChannel = BitsPerChannelType.EIGHT;
      dup.convertProfile('sRGB IEC61966-2.1', Intent.RELATIVECOLORIMETRIC, true, false);
      var o = new PNGSaveOptions();
      o.compression = 6;
      o.interlaced = false;
      dup.saveAs(file, o, true, Extension.LOWERCASE);
    } finally {
      dup.close(SaveOptions.DONOTSAVECHANGES);
    }
  }

  if (!app.documents.length) throw new Error('Open the master document first.');
  var doc = app.activeDocument;
  var t = target(doc);
  var frames = [];
  for (var i = 0; i < doc.layers.length; i++) if (/^frame:/i.test(doc.layers[i].name)) frames.push(doc.layers[i]);
  if (!frames.length) {
    exportPng(doc, File(t.folder + '/' + t.name + '.png'));
    return;
  }
  var vis = [];
  for (var k = 0; k < doc.layers.length; k++) vis.push(doc.layers[k].visible);
  try {
    for (var f = 0; f < frames.length; f++) {
      for (var j = 0; j < doc.layers.length; j++) {
        var L = doc.layers[j];
        L.visible = L === frames[f] || !/^frame:/i.test(L.name);
      }
      var frame = kebab(frames[f].name.split(':')[1]);
      if (!NAME_RE.test(frame)) throw new Error('Frame layer "' + frames[f].name + '" breaks the naming rule');
      exportPng(doc, File(t.folder + '/' + frame + '.png'));
    }
  } finally {
    for (var v = 0; v < doc.layers.length; v++) doc.layers[v].visible = vis[v];
  }
})();
