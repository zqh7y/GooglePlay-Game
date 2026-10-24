import * as THREE from "three";
import { MOODS, World3D } from "./world3d";

/**
 * The loading screen's scene: a sunny golden-hour flight around the first land. The camera sways
 * slowly around it, dice circle the glowing crystal, the box ghost hops about and the other lands
 * float away into the haze behind.
 */
export function loadingScene(w: World3D): void {
  w.setMood(MOODS.day);
  w.openFlaps(1);
  w.eyes = 1;
  w.islands.forEach((isl) => isl.crystal.setLight(1));
  const look = new THREE.Vector3();
  const spin = w.dice.map(() => new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize());
  w.dice.forEach((d) => (d.visible = true));
  w.onTick((t) => {
    const tall = w.camera.aspect < 1;
    const a = 0.3 + Math.sin(t * 0.12) * 0.45;
    const r = tall ? 14 : 13;
    w.camera.position.set(Math.sin(a) * r, (tall ? 5.2 : 5) + Math.sin(t * 0.2) * 0.5, Math.cos(a) * r);
    // wide screens: the land sits lower, under the logo
    look.set(0.2, tall ? 2.2 : 3.4, -4);
    w.camera.lookAt(look);
    // dice circling the crystal, tumbling as they go
    const g = w.ground();
    w.dice.forEach((d, i) => {
      const k = t * 0.45 + (i / w.dice.length) * Math.PI * 2;
      d.position.set(Math.cos(k) * 2.3, g + 2.5 + Math.sin(t * 1.6 + i) * 0.3, Math.sin(k) * 2.3);
      d.quaternion.setFromAxisAngle(spin[i], t * (0.8 + i * 0.12));
    });
    // the hero hops now and then and looks around
    const hop = t % 2.6;
    w.heroHop = hop < 0.45 ? Math.sin((hop / 0.45) * Math.PI) * 0.35 : 0;
    w.hero.group.rotation.y = Math.sin(t * 0.5) * 0.35 + a * 0.6;
    w.hero.body.scale.set(1, hop > 0.45 && hop < 0.6 ? 0.92 : 1, 1);
  });
}
