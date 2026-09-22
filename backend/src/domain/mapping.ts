export interface RoomMappingStatus {
  roomId: string | null;
  exists: boolean;
  completed: boolean;
  source: 'mapping_report_provenance' | 'not_selected';
}

/**
 * The repository has no South Operation Room/MappingReport tables or API
 * contract. A non-empty source_mapping_report_id is therefore the safest
 * local evidence that a room has a usable completed mapping. This intentionally
 * does not use the number of currently eligible Items as the mapping signal.
 */
export function mappingStatusFromProvenance(
  roomId: string | undefined,
  mappedItemCount: number,
): RoomMappingStatus {
  if (!roomId) {
    return {
      roomId: null,
      exists: false,
      completed: false,
      source: 'not_selected',
    };
  }

  const mapped = mappedItemCount > 0;
  return {
    roomId,
    exists: mapped,
    completed: mapped,
    source: 'mapping_report_provenance',
  };
}
