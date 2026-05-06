export type TrackMetadata = {
  provider: string
  trackId: string
  title: string
  artist: string | null
  thumbnailUrl: string | null
  durationSec: number | null
  audioUrl: string | null
}

export type TrackSearchResult = TrackMetadata

export interface MusicProvider {
  search(query: string, limit?: number): Promise<TrackSearchResult[]>
  getMetadata(trackId: string): Promise<TrackMetadata | null>
}

