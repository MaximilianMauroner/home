export type Coordinates = { latitude: number; longitude: number };

export type PhotoMetadata = {
  capturedAt?: Date;
  capturedAtLabel?: string;
  /** Minutes east of UTC from OffsetTimeOriginal. Without it the capture clock has no zone. */
  utcOffsetMinutes?: number;
  modifiedAtLabel: string;
  coordinates?: Coordinates;
  altitude?: number;
  place?: string;
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  dimensions: string;
  fileSize: string;
  fileType: string;
  details: Array<{ label: string; value: string }>;
};

export type JourneyPhoto = {
  id: string;
  file: File;
  /** Object URL for the original file, shown only in the large detail frame. */
  url: string;
  /** Object URL for the downscaled preview used by the filmstrip and map markers. */
  thumbnailUrl: string;
  dominantColor?: string;
  name: string;
  metadata: PhotoMetadata;
  importOrder: number;
};
