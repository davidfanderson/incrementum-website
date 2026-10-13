// Generated from src/sharedEmpireRules.ts; SHA-256 98eb178a33c3341b85cea03fca901910abbb2b548def59fc81d63c76cda5fc87; TypeScript 6.0.3.
// Regenerate with node scripts/buildWebsiteDemo.cjs; do not edit by hand.
import { maximumDefense } from './empire-rules.mjs';
function requireText(value, label) {
    const normalized = value.trim();
    if (!normalized)
        throw new Error(`${label} is required.`);
    return normalized;
}
function normalizeTimestamp(value) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Date.now();
}
function normalizeArea(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Territory tile area must be a positive finite number.');
    }
    return value;
}
function validateTile(tile) {
    requireText(tile.index, 'H3 tile index');
    requireText(tile.ownerId, 'Owner id');
    if (!Number.isInteger(tile.reinforcementCount) || tile.reinforcementCount < 1) {
        throw new Error('Reinforcement count must be a positive integer.');
    }
    if (!Number.isFinite(tile.defense) || tile.defense <= 0) {
        throw new Error('Defense must be a positive finite number.');
    }
    normalizeArea(tile.areaSquareMeters);
}
export function captureSharedTile(input) {
    const timestamp = normalizeTimestamp(input.capturedAt);
    return {
        index: requireText(input.index, 'H3 tile index'),
        ownerId: requireText(input.ownerId, 'Owner id'),
        reinforcementCount: 1,
        defense: 1,
        areaSquareMeters: normalizeArea(input.areaSquareMeters),
        firstCapturedAt: timestamp,
        lastAffectedAt: timestamp,
        lastActivityId: requireText(input.activityId, 'Activity id'),
    };
}
export function fortifySharedTile(tile, activityId, affectedAt) {
    validateTile(tile);
    const nextReinforcementCount = tile.reinforcementCount + 1;
    return {
        ...tile,
        reinforcementCount: nextReinforcementCount,
        defense: Math.min(tile.defense + 1, maximumDefense(nextReinforcementCount)),
        lastAffectedAt: normalizeTimestamp(affectedAt),
        lastActivityId: requireText(activityId, 'Activity id'),
    };
}
export function attackSharedTile(tile, attackerId, activityId, affectedAt) {
    validateTile(tile);
    const normalizedAttackerId = requireText(attackerId, 'Attacker id');
    if (tile.ownerId === normalizedAttackerId) {
        throw new Error('A player cannot attack their own tile.');
    }
    const normalizedActivityId = requireText(activityId, 'Activity id');
    const timestamp = normalizeTimestamp(affectedAt);
    const damagedDefense = tile.defense - 1;
    if (damagedDefense <= 0) {
        return {
            effect: 'conquered',
            tile: {
                ...tile,
                ownerId: normalizedAttackerId,
                reinforcementCount: 1,
                defense: 1,
                firstCapturedAt: timestamp,
                lastAffectedAt: timestamp,
                lastActivityId: normalizedActivityId,
            },
        };
    }
    return {
        effect: 'attacked',
        tile: {
            ...tile,
            defense: damagedDefense,
            lastAffectedAt: timestamp,
            lastActivityId: normalizedActivityId,
        },
    };
}
export function applySharedActivity(currentTiles, actorId, activityId, affectedTiles, affectedAt) {
    const normalizedActorId = requireText(actorId, 'Actor id');
    const normalizedActivityId = requireText(activityId, 'Activity id');
    const nextTiles = new Map();
    for (const [index, tile] of currentTiles) {
        validateTile(tile);
        nextTiles.set(index, { ...tile });
    }
    const uniqueTiles = new Map();
    for (const tile of affectedTiles) {
        const index = requireText(tile.index, 'H3 tile index');
        if (!uniqueTiles.has(index))
            uniqueTiles.set(index, normalizeArea(tile.areaSquareMeters));
    }
    const effects = [];
    let capturedCount = 0;
    let fortifiedCount = 0;
    let attackedCount = 0;
    let conqueredCount = 0;
    let affectedAreaSquareMeters = 0;
    for (const index of [...uniqueTiles.keys()].sort()) {
        const submittedArea = uniqueTiles.get(index);
        if (submittedArea === undefined)
            continue;
        const previous = nextTiles.get(index);
        const areaSquareMeters = previous?.areaSquareMeters ?? submittedArea;
        affectedAreaSquareMeters += areaSquareMeters;
        if (!previous) {
            const captured = captureSharedTile({
                index,
                ownerId: normalizedActorId,
                areaSquareMeters,
                activityId: normalizedActivityId,
                capturedAt: affectedAt,
            });
            nextTiles.set(index, captured);
            capturedCount += 1;
            effects.push({
                index,
                effect: 'captured',
                beforeOwnerId: null,
                afterOwnerId: captured.ownerId,
                beforeReinforcementCount: 0,
                afterReinforcementCount: captured.reinforcementCount,
                beforeDefense: 0,
                afterDefense: captured.defense,
                areaSquareMeters,
            });
            continue;
        }
        if (previous.ownerId === normalizedActorId) {
            const fortified = fortifySharedTile(previous, normalizedActivityId, affectedAt);
            nextTiles.set(index, fortified);
            fortifiedCount += 1;
            effects.push({
                index,
                effect: 'fortified',
                beforeOwnerId: previous.ownerId,
                afterOwnerId: fortified.ownerId,
                beforeReinforcementCount: previous.reinforcementCount,
                afterReinforcementCount: fortified.reinforcementCount,
                beforeDefense: previous.defense,
                afterDefense: fortified.defense,
                areaSquareMeters,
            });
            continue;
        }
        const attacked = attackSharedTile(previous, normalizedActorId, normalizedActivityId, affectedAt);
        nextTiles.set(index, attacked.tile);
        if (attacked.effect === 'conquered')
            conqueredCount += 1;
        else
            attackedCount += 1;
        effects.push({
            index,
            effect: attacked.effect,
            beforeOwnerId: previous.ownerId,
            afterOwnerId: attacked.tile.ownerId,
            beforeReinforcementCount: previous.reinforcementCount,
            afterReinforcementCount: attacked.tile.reinforcementCount,
            beforeDefense: previous.defense,
            afterDefense: attacked.tile.defense,
            areaSquareMeters,
        });
    }
    return {
        tiles: nextTiles,
        effects,
        capturedCount,
        fortifiedCount,
        attackedCount,
        conqueredCount,
        affectedAreaSquareMeters,
    };
}
