import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AnalysisResponseSchema } from "./schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 간단한 메모리 기반 Rate Limit (Vercel Serverless 환경에서는 인스턴스별로 초기화됨)
// 실제 운영 환경에서는 Redis(Upstash 등) 권장
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const LIMIT_COUNT = 5; // IP당 1분 내 5회 제한
const LIMIT_WINDOW = 60 * 1000; // 1분

function checkRateLimit(ip: string) {
  const now = Date.now();
  const userData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  if (now - userData.lastReset > LIMIT_WINDOW) {
    userData.count = 1;
    userData.lastReset = now;
  } else {
    userData.count++;
  }

  rateLimitMap.set(ip, userData);
  return userData.count <= LIMIT_COUNT;
}

export async function POST(req: Request) {
  // 1. Rate Limit 체크
  const ip = req.headers.get("x-forwarded-for") || "anonymous";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (분당 5회 제한)" },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    // 2. 이미지 검증 (서버 사이드)
    if (!file) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지 용량은 5MB를 초과할 수 없습니다." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");

    // 3. OpenAI API 호출 (타임아웃 설정)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25초 타임아웃 (Vercel 기본 30초 고려)

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 음식 영양 분석 전문가입니다. 한국 음식의 특성을 잘 반영하여 영양 정보를 제공하세요. 
            반드시 지정된 JSON 형식으로만 응답하세요. 
            음식이 불명확하면 confidence를 'low'로 설정하고 reason에 구체적인 이유를 적으세요.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "분석 결과는 JSON으로만 줘." },
              {
                type: "image_url",
                image_url: { url: `data:${file.type};base64,${base64Image}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }, { signal: controller.signal });

      clearTimeout(timeoutId);

      const content = response.choices[0].message.content;
      if (!content) throw new Error("AI 응답을 생성하지 못했습니다.");

      const validatedData = AnalysisResponseSchema.parse(JSON.parse(content));
      return NextResponse.json(validatedData);

    } catch (apiError: any) {
      if (apiError.name === 'AbortError') {
        return NextResponse.json({ error: "분석 시간이 너무 오래 걸립니다. 다시 시도해주세요." }, { status: 504 });
      }
      throw apiError;
    }

  } catch (error: any) {
    console.error("Analysis API Error:", error);
    const message = error.name === "ZodError" 
      ? "데이터 분석 형식이 올바르지 않습니다." 
      : (error.message || "서버 오류가 발생했습니다.");
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
