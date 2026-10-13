// Generated from src/empireRules.ts; SHA-256 f9fb05719807e4af4de9c2cefbf99a9decb4c4e544504b178473805712d46fd4; TypeScript 6.0.3.
// Regenerate with node scripts/buildWebsiteDemo.cjs; do not edit by hand.
export const LOCAL_EMPIRE_SCHEMA_VERSION = 1;
export const H3_TERRITORY_RESOLUTION = 12;
function normalizeTimestamp(value) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Date.now();
}
function normalizeArea(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Territory tile area must be a positive finite number.');
    }
    return value;
}
export function maximumDefense(reinforcementCount) {
    if (!Number.isInteger(reinforcementCount) || reinforcementCount < 1) {
        throw new Error('Reinforcement count must be a positive integer.');
    }
    return Math.sqrt(reinforcementCount);
}
export function fortifyTile(tile, activityId, affectedAt) {
    if (!activityId)
        throw new Error('Activity id is required.');
    const nextReinforcementCount = tile.reinforcementCount + 1;
    const nextDefense = Math.min(tile.defense + 1, maximumDefense(nextReinforcementCount));
    return {
        ...tile,
        reinforcementCount: nextReinforcementCount,
        defense: nextDefense,
        lastAffectedAt: normalizeTimestamp(affectedAt),
        lastActivityId: activityId,
    };
}
export function captureTile(index, areaSquareMeters, activityId, capturedAt) {
    if (!index)
        throw new Error('H3 tile index is required.');
    if (!activityId)
        throw new Error('Activity id is required.');
    const timestamp = normalizeTimestamp(capturedAt);
    return {
        index,
        reinforcementCount: 1,
        defense: 1,
        areaSquareMeters: normalizeArea(areaSquareMeters),
        firstCapturedAt: timestamp,
        lastAffectedAt: timestamp,
        lastActivityId: activityId,
    };
}
export function applyLocalActivity(currentTiles, activityId, affectedTiles, affectedAt) {
    if (!activityId)
        throw new Error('Activity id is required.');
    const nextTiles = new Map();
    for (const [index, tile] of currentTiles) {
        nextTiles.set(index, { ...tile });
    }
    const uniqueTiles = new Map();
    for (const tile of affectedTiles) {
        if (!tile.index)
            throw new Error('H3 tile index is required.');
        if (!uniqueTiles.has(tile.index)) {
            uniqueTiles.set(tile.index, normalizeArea(tile.areaSquareMeters));
        }
    }
    const effects = [];
    let capturedCount = 0;
    let fortifiedCount = 0;
    let capturedAreaSquareMeters = 0;
    let affectedAreaSquareMeters = 0;
    for (const index of [...uniqueTiles.keys()].sort()) {
        const areaSquareMeters = uniqueTiles.get(index);
        if (areaSquareMeters === undefined)
            continue;
        affectedAreaSquareMeters += areaSquareMeters;
        const previous = nextTiles.get(index);
        if (!previous) {
            const captured = captureTile(index, areaSquareMeters, activityId, affectedAt);
            nextTiles.set(index, captured);
            capturedCount += 1;
            capturedAreaSquareMeters += areaSquareMeters;
            effects.push({
                index,
                effect: 'captured',
                beforeReinforcementCount: 0,
                afterReinforcementCount: 1,
                beforeDefense: 0,
                afterDefense: 1,
                areaSquareMeters,
            });
            continue;
        }
        const fortified = fortifyTile(previous, activityId, affectedAt);
        nextTiles.set(index, fortified);
        fortifiedCount += 1;
        effects.push({
            index,
            effect: 'fortified',
            beforeReinforcementCount: previous.reinforcementCount,
            afterReinforcementCount: fortified.reinforcementCount,
            beforeDefense: previous.defense,
            afterDefense: fortified.defense,
            areaSquareMeters: previous.areaSquareMeters,
        });
    }
    return {
        tiles: nextTiles,
        effects,
        capturedCount,
        fortifiedCount,
        capturedAreaSquareMeters,
        affectedAreaSquareMeters,
    };
}
