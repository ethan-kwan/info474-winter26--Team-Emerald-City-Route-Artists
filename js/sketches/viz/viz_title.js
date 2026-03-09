// // viz_title.js
// (function () {
//   window.VizTitle = {
//     draw: function (p, manager, ai, progress) {
//       var cx = (manager.offsetX || 0) + (manager.width || 600) / 2;
//       var cy = (manager.offsetY || 0) + (manager.height || 520) / 3;

//       p.push();
//       p.noStroke();
//       p.fill(255);
//       var w = 520;
//       var h = 150;
//       p.rect(cx - w / 2, cy - h / 2, w, h, 12);

//       p.fill(18);
//       p.textAlign(p.CENTER, p.CENTER);

//       p.textSize(18);
//       p.text("Seattle Crash Hotspots", cx, cy - 40);

//       p.textSize(34);
//       p.text("Your Route Through Risk", cx, cy + 5);

//       p.textSize(14);
//       p.fill(80);
//       p.text("Scroll to begin.", cx, cy + 55);
//       p.pop();
//     }
//   };
// })();