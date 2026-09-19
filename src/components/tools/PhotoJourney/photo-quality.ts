import type {
  FaceLandmarker,
  FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { SimilarPhotoGroup, SimilarPhotoScore } from "./photo-similarity";
import type { JourneyPhoto } from "./types";

const TASKS_VERSION = "1.0.1";
export const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
export const FACE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;

let landmarkerPromise: Promise<FaceLandmarker> | undefined;
const faceCache = new Map<string, FaceMeasure>();

type FaceMeasure = {
  faceCount: number;
  eyeScore: number;
  expressionScore: number;
  compositionScore: number;
};

async function faceLandmarker() {
  landmarkerPromise ??= import("@mediapipe/tasks-vision").then(
    async ({ FaceLandmarker, FilesetResolver }) => {
      const files = await FilesetResolver.forVisionTasks(FACE_WASM_URL);
      const options = {
        runningMode: "IMAGE" as const,
        numFaces: 8,
        outputFaceBlendshapes: true,
      };
      return FaceLandmarker.createFromOptions(files, {
        ...options,
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
      }).catch(() =>
        FaceLandmarker.createFromOptions(files, {
          ...options,
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "CPU" },
        }),
      );
    },
  );
  return landmarkerPromise;
}

function category(result: FaceLandmarkerResult, face: number, name: string) {
  return (
    result.faceBlendshapes[face]?.categories.find(
      (entry) => entry.categoryName === name,
    )?.score ?? 0
  );
}

function measureFaces(result: FaceLandmarkerResult): FaceMeasure {
  if (!result.faceLandmarks.length)
    return {
      faceCount: 0,
      eyeScore: 0.72,
      expressionScore: 0.5,
      compositionScore: 0.5,
    };
  let eyeScore = 0;
  let expressionScore = 0;
  let compositionScore = 0;
  result.faceLandmarks.forEach((landmarks, face) => {
    const blink = Math.max(
      category(result, face, "eyeBlinkLeft"),
      category(result, face, "eyeBlinkRight"),
    );
    eyeScore += 1 - blink;
    const expression = Math.max(
      category(result, face, "mouthSmileLeft"),
      category(result, face, "mouthSmileRight"),
      category(result, face, "browInnerUp"),
      category(result, face, "jawOpen") * 0.7,
    );
    expressionScore += 0.45 + expression * 0.55;
    const xs = landmarks.map(({ x }) => x);
    const ys = landmarks.map(({ y }) => y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const thirdDistance =
      Math.min(Math.abs(centerX - 1 / 3), Math.abs(centerX - 2 / 3)) +
      Math.min(Math.abs(centerY - 1 / 3), Math.abs(centerY - 2 / 3));
    compositionScore += Math.max(0, 1 - thirdDistance * 2.4);
  });
  const count = result.faceLandmarks.length;
  return {
    faceCount: count,
    eyeScore: eyeScore / count,
    expressionScore: expressionScore / count,
    compositionScore: compositionScore / count,
  };
}

async function imageFor(photo: JourneyPhoto) {
  const image = new Image();
  image.decoding = "async";
  image.src = photo.url;
  await image.decode();
  return image;
}

async function facesFor(photo: JourneyPhoto, landmarker: FaceLandmarker) {
  const cached = faceCache.get(photo.id);
  if (cached) return cached;
  const image = await imageFor(photo);
  const result = measureFaces(landmarker.detect(image));
  faceCache.set(photo.id, result);
  return result;
}

function scorePhoto(
  photo: JourneyPhoto,
  faces: FaceMeasure,
): SimilarPhotoScore {
  const visual = photo.visualFeatures!;
  const technical =
    Math.min(1, visual.sharpness * 11) * 0.55 + visual.exposure * 0.45;
  const visualComposition = Math.min(1, visual.composition * 2.3);
  const composition = faces.faceCount
    ? faces.compositionScore * 0.7 + visualComposition * 0.3
    : visualComposition;
  const moment = faces.faceCount
    ? faces.eyeScore * 0.58 + faces.expressionScore * 0.42
    : Math.min(1, visual.colorfulness * 2.4) * 0.45 + composition * 0.55;
  const score = moment * 0.44 + composition * 0.34 + technical * 0.22;
  const reason =
    faces.faceCount && faces.eyeScore > 0.76
      ? "Strong expression and open eyes"
      : composition > 0.66
        ? "Strong composition and moment"
        : "Best balance of moment and image quality";
  return { photoId: photo.id, score, reason, faceCount: faces.faceCount };
}

/** Downloads only the model/runtime. Source pixels are passed directly to local WASM/WebGL. */
export async function rankSimilarPhotoGroups(
  photos: readonly JourneyPhoto[],
  groups: readonly SimilarPhotoGroup[],
) {
  if (!groups.length) return [...groups];
  const landmarker = await faceLandmarker();
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const ranked: SimilarPhotoGroup[] = [];
  for (const group of groups) {
    const scores: SimilarPhotoScore[] = [];
    for (const photoId of group.photoIds) {
      const photo = byId.get(photoId);
      if (!photo?.visualFeatures) continue;
      scores.push(scorePhoto(photo, await facesFor(photo, landmarker)));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    scores.sort(
      (a, b) =>
        b.score - a.score ||
        (byId.get(a.photoId)?.importOrder ?? 0) -
          (byId.get(b.photoId)?.importOrder ?? 0),
    );
    ranked.push({ ...group, recommendedId: scores[0]?.photoId, scores });
  }
  return ranked;
}

export function resetPhotoQualityModelForTests() {
  landmarkerPromise = undefined;
  faceCache.clear();
}
