import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Injectable, Logger } from '@nestjs/common';
import { ReportCategory, ReportUrgency } from '@prisma/client';
import { z } from 'zod';
import type { AnalyzePhotoInput } from '../domain/facility.schemas.js';
import { routeReport } from '../domain/facility.js';
import { db } from '../lib/db.js';

// What the model is asked to pull out of the photo. The report screen shows
// these fields for review and lets the user correct any of them before the
// call is opened.
const analysisSchema = z.object({
  objectLabel: z.string(),
  issueDescription: z.string(),
  category: z.nativeEnum(ReportCategory),
  urgency: z.nativeEnum(ReportUrgency),
  locationHint: z.string(),
  confidence: z.number(),
});

export interface FacilityAnalysis {
  objectLabel: string;
  issueDescription: string;
  category: ReportCategory;
  urgency: ReportUrgency;
  locationDescription: string;
  confidence: number;
  assignedTeam: string;
  expectedResponseHours: number;
  // Tells the UI whether a model actually looked at the photo, so a draft
  // produced without one is never presented as an AI finding.
  source: 'ai' | 'unavailable';
}

const SYSTEM_PROMPT = [
  'אתה עוזר תחזוקה במתחם משרדים של צה"ל בדרום.',
  'המשתמש מצלם פריט או תקלה ואתה מזהה מה רואים בתמונה.',
  'ענה תמיד בעברית, בניסוח קצר ועובדתי שמתאים לכרטיס קריאת שירות.',
  'objectLabel: שם הפריט שבתמונה, עד 6 מילים (למשל "כיסא משרדי").',
  'issueDescription: התקלה שרואים בתמונה, עד 15 מילים (למשל "ידית שבורה").',
  'category: סיווג הקריאה לגורם המטפל.',
  'urgency: high כשיש סיכון בטיחותי או השבתה, medium לתקלה שמפריעה לעבודה, low לתקלה אסתטית.',
  'locationHint: המיקום ככל שניתן להסיק מהתמונה, אחרת מחרוזת ריקה.',
  'confidence: מספר בין 0 ל-1 שמבטא את רמת הוודאות בזיהוי.',
].join('\n');

const MODEL = 'claude-opus-5';

@Injectable()
export class FacilityAiService {
  private readonly logger = new Logger(FacilityAiService.name);

  // The SDK reads ANTHROPIC_API_KEY itself; without credentials the analysis
  // step degrades to an editable empty draft instead of failing the flow.
  private readonly client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ timeout: 45_000, maxRetries: 1 })
    : null;

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async analyzePhoto(input: AnalyzePhotoInput): Promise<FacilityAnalysis> {
    const room = input.roomId
      ? await db.room.findUnique({ where: { id: input.roomId } })
      : null;
    const roomLocation = room
      ? `${room.name}, בניין ${room.building}, קומה ${room.floor}`
      : '';
    const roomContext = roomLocation ? `החדר שנבחר: ${roomLocation}.` : null;

    if (!this.client) return emptyDraft(roomLocation);

    const { mediaType, data } = splitDataUrl(input.photo);

    try {
      const response = await this.client.messages.parse({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        output_config: {
          format: zodOutputFormat(analysisSchema),
          effort: 'low',
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data },
              },
              {
                type: 'text',
                text: [
                  'זהה את הפריט ואת התקלה בתמונה עבור דיווח תחזוקה.',
                  roomContext,
                  input.note ? `הערת המדווח: ${input.note}` : null,
                ]
                  .filter(Boolean)
                  .join('\n'),
              },
            ],
          },
        ],
      });

      const parsed = response.parsed_output;
      if (!parsed) return emptyDraft(roomLocation);

      const { category, urgency } = parsed;
      const routing = routeReport(category, urgency);

      return {
        objectLabel: parsed.objectLabel.trim(),
        issueDescription: parsed.issueDescription.trim(),
        category,
        urgency,
        locationDescription: parsed.locationHint.trim() || roomLocation,
        confidence: clampConfidence(parsed.confidence),
        ...routing,
        source: 'ai',
      };
    } catch (error) {
      // A model outage must not block a maintenance call: the user still gets
      // the review screen and can fill the details in by hand.
      this.logger.error(
        `Photo analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return emptyDraft(roomLocation);
    }
  }
}

function emptyDraft(locationHint: string): FacilityAnalysis {
  const routing = routeReport(ReportCategory.other, ReportUrgency.medium);
  return {
    objectLabel: '',
    issueDescription: '',
    category: ReportCategory.other,
    urgency: ReportUrgency.medium,
    locationDescription: locationHint,
    confidence: 0,
    ...routing,
    source: 'unavailable',
  };
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function splitDataUrl(dataUrl: string): {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
} {
  const [header, data = ''] = dataUrl.split(',', 2);
  const mediaType = header.slice('data:'.length, header.indexOf(';'));
  return {
    mediaType: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
    data,
  };
}
