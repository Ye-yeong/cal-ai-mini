"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, AlertCircle, CheckCircle2, RefreshCcw, Flame, Info, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AnalysisResponseSchema, type AnalysisResponse } from "./api/analyze/schema";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AppState = "idle" | "loading" | "success" | "error";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("5MB 이하의 사진을 사용해주세요.");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setState("idle");
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!imageFile) return;
    setState("loading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "분석 실패");

      const validatedData = AnalysisResponseSchema.parse(data);
      setResult(validatedData);
      setState("success");
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
      setState("error");
    }
  };

  const reset = () => {
    setImage(null);
    setImageFile(null);
    setResult(null);
    setState("idle");
    setError(null);
    setIsDetailsOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans overflow-x-hidden">
      {/* 상단 고정 헤더 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100 flex items-center justify-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FFD600] rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-lg">🥗</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-800">Cal AI</h1>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-32 px-4 flex flex-col items-center w-full max-w-md mx-auto space-y-6">
        {/* 안내 문구 */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-slate-800">영양 성분 분석</h2>
          <p className="text-sm text-slate-500 font-medium">사진 한 장으로 칼로리를 확인하세요</p>
        </div>

        {/* 메인 카드 영역 */}
        <div className="w-full bg-white rounded-[2.5rem] p-5 shadow-xl shadow-slate-200/50 border border-slate-100 relative">
          {!image ? (
            /* Placeholder / Upload Area */
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-slate-200 rounded-[2rem] py-16 flex flex-col items-center justify-center cursor-pointer hover:border-[#4FB3FF] hover:bg-[#E0F2FE]/30 transition-all duration-300"
            >
              <div className="w-20 h-20 bg-[#E0F2FE] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Camera className="w-10 h-10 text-[#4FB3FF]" />
              </div>
              <p className="text-lg text-slate-600 font-bold">음식 사진 촬영하기</p>
              <p className="text-sm text-slate-400 mt-2">터치하여 시작</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                capture="environment"
                className="hidden" 
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Image Preview */}
              <div className="relative aspect-[4/3] rounded-[1.5rem] overflow-hidden bg-slate-100 shadow-inner">
                <img src={image} alt="Uploaded" className="object-cover w-full h-full" />
                {state !== "loading" && (
                  <button onClick={reset} className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-slate-600 p-2 rounded-xl shadow-lg">
                    <RefreshCcw className="w-5 h-5" />
                  </button>
                )}
                {state === "loading" && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mb-3 text-[#FFD600]" />
                    <p className="font-bold">AI 분석 중...</p>
                  </div>
                )}
              </div>

              {/* Success Result */}
              {state === "success" && result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* kcal 강조 */}
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <ConfidenceBadge confidence={result.confidence} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">추정치</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800">{result.food_name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-black text-slate-900">{result.estimated_kcal}</span>
                      <span className="text-lg font-bold text-slate-400 uppercase">kcal</span>
                    </div>
                  </div>

                  {/* 탄단지 가로 바 */}
                  <div className="space-y-4 bg-slate-50 p-5 rounded-[1.5rem]">
                    <MacroRow label="탄수화물" value={result.macros_g.carbs} color="bg-green-400" />
                    <MacroRow label="단백질" value={result.macros_g.protein} color="bg-blue-400" />
                    <MacroRow label="지방" value={result.macros_g.fat} color="bg-orange-400" />
                  </div>

                  {/* 아코디언 */}
                  <div className="border-t border-slate-100 pt-4">
                    <button 
                      onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                      className="w-full flex items-center justify-between py-2 text-slate-500 font-bold text-sm"
                    >
                      <span>상세 분석 근거</span>
                      {isDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isDetailsOpen && (
                      <div className="mt-3 space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-slate-50 p-4 rounded-xl">
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">{result.reason}</p>
                        </div>
                        {result.notes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase ml-1">AI Notes</p>
                            {result.notes.map((note, i) => (
                              <div key={i} className="flex gap-2 text-[11px] text-slate-500 leading-tight">
                                <span className="text-[#4FB3FF]">•</span>
                                <span>{note}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* 하단 정보 */}
        <div className="w-full bg-slate-100/50 rounded-3xl p-5 border border-slate-200/50 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-600">개인정보 및 이미지 처리</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">업로드된 이미지는 분석 즉시 파기되며 서버에 저장되지 않습니다. AI 수치는 참고용으로만 활용하세요.</p>
          </div>
        </div>
      </main>

      {/* 하단 고정 버튼 영역 */}
      {image && state !== "success" && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent z-50">
          <div className="max-w-md mx-auto">
            <button
              onClick={analyzeImage}
              disabled={state === "loading"}
              className="w-full bg-[#4FB3FF] text-white py-5 rounded-[1.5rem] font-bold text-lg shadow-lg shadow-[#4FB3FF]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {state === "loading" ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
              AI로 분석하기
            </button>
          </div>
        </div>
      )}

      {state === "success" && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent z-50">
          <div className="max-w-md mx-auto">
            <button
              onClick={reset}
              className="w-full bg-slate-800 text-white py-5 rounded-[1.5rem] font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
            >
              새로운 사진 찍기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroRow({ label, value, color }: { label: string, value: number, color: string }) {
  // 최대 100g 기준으로 바 너비 계산 (단순 시각화용)
  const width = Math.min(100, (value / 60) * 100); 
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <span className="text-xs font-black text-slate-800">{value}g</span>
      </div>
      <div className="h-2 w-full bg-white rounded-full overflow-hidden shadow-inner">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "low" | "medium" | "high" }) {
  const styles = {
    high: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-red-100 text-red-700",
  };
  const labels = { high: "높음", medium: "보통", low: "낮음" };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider", styles[confidence])}>
      신뢰도 {labels[confidence]}
    </span>
  );
}
