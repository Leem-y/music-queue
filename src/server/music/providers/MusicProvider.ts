export type TrackMetadata = {
  youtubeId: string
  title: string
  artist: string | null
  thumbnailUrl: string | null
  durationSec: number | null
}

export type TrackSearchResult = TrackMetadata

export interface MusicProvider {
  search(query: string, limit?: number): Promise<TrackSearchResult[]>
  getMetadata(youtubeId: string): Promise<TrackMetadata | null>
}

