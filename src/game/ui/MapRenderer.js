import { CHUNK_HEIGHT, CHUNK_SIZE } from '../world/WorldGenerator.js';
import { BIOMES, BiomeSystem, SAFE_ZONE } from '../world/BiomeSystem.js';

const WORLD_RADIUS = 14400;

export class MapRenderer {
  drawMinimap(canvas, character, chunks = []) {
    if (!canvas || !character) return;
    const context = canvas.getContext('2d');
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101a14';
    context.fillRect(0, 0, width, height);
    const scale = Math.min((width - 18) / 520, (height - 18) / 390);
    const centerX = width / 2;
    const centerY = height / 2;
    const px = (x) => centerX + (x - character.position.x) * scale;
    const py = (y) => centerY + (y - character.position.y) * scale;
    context.strokeStyle = '#344a36';
    context.lineWidth = 1;
    for (let step = -2; step <= 2; step += 1) {
      context.beginPath(); context.moveTo(centerX + step * 48, 8); context.lineTo(centerX + step * 48, height - 8); context.stroke();
      context.beginPath(); context.moveTo(8, centerY + step * 32); context.lineTo(width - 8, centerY + step * 32); context.stroke();
    }
    const safeX = px(0);
    const safeY = py(0);
    context.fillStyle = 'rgba(167,220,119,.055)';
    context.beginPath(); context.arc(safeX, safeY, SAFE_ZONE.radius * scale, 0, Math.PI * 2); context.fill();
    context.strokeStyle = 'rgba(190,230,143,.35)'; context.setLineDash([3, 4]);
    context.beginPath(); context.arc(safeX, safeY, SAFE_ZONE.radius * scale, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
    for (const chunk of chunks) {
      for (const point of chunk.points) {
        if (point.dead || point.collected || !['slime', 'monster', 'resource'].includes(point.kind)) continue;
        const x = px(point.x); const y = py(point.y);
        if (x < 3 || y < 3 || x > width - 3 || y > height - 3) continue;
        context.fillStyle = point.kind === 'monster' ? point.monsterId === 'voidSlime' ? '#cf8cff' : point.monsterId === 'orc' ? '#9ab56b' : point.monsterId === 'goblin' ? '#c0db7b' : point.monsterId === 'wraith' ? '#80ded0' : '#b99aff' : point.kind === 'slime' ? point.variant === 'voidSlime' ? '#cf8cff' : '#ef9380' : point.resource === 'stone' ? '#d3d9cd' : point.resource === 'wood' ? '#a9d17b' : '#e2c880';
        context.beginPath(); context.arc(x, y, point.elite ? 4.2 : point.kind === 'slime' || point.kind === 'monster' ? 3.1 : 2.3, 0, Math.PI * 2); context.fill();
      }
    }
    context.fillStyle = '#b5df76';
    context.shadowColor = '#b5df76'; context.shadowBlur = 9;
    context.beginPath(); context.moveTo(centerX, centerY - 7); context.lineTo(centerX + 5, centerY + 5); context.lineTo(centerX, centerY + 2); context.lineTo(centerX - 5, centerY + 5); context.closePath(); context.fill();
    context.shadowBlur = 0;
  }
  drawWorld(canvas, character) {
    if (!canvas || !character) return;
    const context = canvas.getContext('2d');
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#101913'; context.fillRect(0, 0, width, height);
    const pad = 34;
    const mapWidth = width - pad * 2;
    const mapHeight = height - pad * 2;
    const scale = Math.min(mapWidth, mapHeight) / (WORLD_RADIUS * 2);
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusFor = (distance) => distance * scale;
    const biomeColors = ['#36523b', '#526342', '#465746'];
    const boundaries = [...BIOMES.map((biome) => biome.minDistance), WORLD_RADIUS];
    for (let index = boundaries.length - 2; index >= 0; index -= 1) {
      context.fillStyle = biomeColors[index];
      context.beginPath(); context.arc(centerX, centerY, radiusFor(boundaries[index + 1]), 0, Math.PI * 2); context.fill();
    }
    for (let index = 1; index < boundaries.length - 1; index += 1) {
      context.strokeStyle = 'rgba(218,231,193,.35)'; context.lineWidth = 1;
      context.beginPath(); context.arc(centerX, centerY, radiusFor(boundaries[index]), 0, Math.PI * 2); context.stroke();
    }
    context.fillStyle = 'rgba(169,224,129,.11)';
    context.beginPath(); context.arc(centerX, centerY, radiusFor(SAFE_ZONE.radius), 0, Math.PI * 2); context.fill();
    context.strokeStyle = 'rgba(196,236,154,.92)'; context.lineWidth = 2;
    context.beginPath(); context.arc(centerX, centerY, radiusFor(SAFE_ZONE.radius), 0, Math.PI * 2); context.stroke();
    context.save();
    context.beginPath(); context.arc(centerX, centerY, radiusFor(WORLD_RADIUS), 0, Math.PI * 2); context.clip();
    for (const key of character.exploredChunks ?? ['0,0']) {
      const [cx, cy] = key.split(',').map(Number);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      const x = centerX + (cx * CHUNK_SIZE + CHUNK_SIZE / 2) * scale;
      const y = centerY + (cy * CHUNK_HEIGHT + CHUNK_HEIGHT / 2) * scale;
      const cellWidth = CHUNK_SIZE * scale;
      const cellHeight = CHUNK_HEIGHT * scale;
      context.fillStyle = 'rgba(220,238,168,.16)';
      context.fillRect(x - cellWidth / 2, y - cellHeight / 2, Math.max(2, cellWidth), Math.max(2, cellHeight));
    }
    context.restore();
    context.strokeStyle = 'rgba(226,238,205,.5)'; context.lineWidth = 1.5;
    context.beginPath(); context.arc(centerX, centerY, radiusFor(WORLD_RADIUS), 0, Math.PI * 2); context.stroke();
    const playerX = centerX + character.position.x * scale;
    const playerY = centerY + character.position.y * scale;
    context.strokeStyle = 'rgba(235,244,207,.85)'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(centerX, centerY); context.lineTo(playerX, playerY); context.stroke();
    context.fillStyle = '#ead79b'; context.beginPath(); context.arc(centerX, centerY, 4.5, 0, Math.PI * 2); context.fill();
    context.fillStyle = 'rgba(245,226,167,.9)'; context.font = '9px monospace'; context.fillText('⌂ CIDADE', centerX + 9, centerY + 14);
    context.fillStyle = '#c9ef83'; context.shadowColor = '#c9ef83'; context.shadowBlur = 12;
    context.beginPath(); context.arc(playerX, playerY, 6, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
    BIOMES.forEach((biome, index) => {
      const labelDistance = index === 0 ? 500 : (biome.minDistance + (BIOMES[index + 1]?.minDistance ?? WORLD_RADIUS)) / 2;
      const lx = centerX + labelDistance * scale * 0.69;
      const ly = centerY - labelDistance * scale * 0.72;
      context.fillStyle = 'rgba(240,245,221,.82)'; context.font = '10px monospace';
      context.fillText(biome.name.toLocaleUpperCase('pt-BR'), lx, ly);
    });
    const biome = BiomeSystem.at(character.position.x, character.position.y);
    const footer = document.querySelector('#world-map-location');
    if (footer) footer.textContent = `Posição: ${Math.floor(character.position.x)}, ${Math.floor(character.position.y)} · Cidade a ${Math.floor(Math.hypot(character.position.x, character.position.y))}m · ${biome.name} · ${character.exploredChunks?.length ?? 1} chunks`;
  }
}
