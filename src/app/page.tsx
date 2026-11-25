import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  CheckCircle2,
  Cpu,
  Download,
  DraftingCompass,
  FileCode2,
  Layers,
  Ruler,
  Scissors,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { HeroCadPreview } from "@/components/landing/HeroCadPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TEMPLATE_CATALOG } from "@/templates/registry";

const COMPATIBLE_SYSTEMS = [
  {
    name: "Gerber AccuMark",
    detail: "DXF-AAMA / ASTM R12 • Nhận diện lớp CUT/SEW/NOTCH",
  },
  {
    name: "Optitex PDS",
    detail: "Nhập trực tiếp tỉ lệ 1:1 mm • Giữ nguyên đường canh sợi",
  },
  {
    name: "CLO3D / Marvelous",
    detail: "Tương thích mô phỏng 3D • Tách mảnh chính & bản lưng",
  },
  {
    name: "Lectra & AutoCAD",
    detail: "Chuẩn vector cung tròn (ARC) & đa tuyến chính xác 0.01 mm",
  },
];

const CORE_PILLARS = [
  {
    icon: Blocks,
    title: "Kiến trúc Template Plugin mở rộng (Modular Engine)",
    description:
      "Mỗi dòng trang phục là một module độc lập gồm schema thông số, thuật toán hình học vector và quy tắc nhảy size — sẵn sàng mở rộng từ Chân váy sang Áo sơ mi, Đầm, Quần tây.",
  },
  {
    icon: Ruler,
    title: "Hình học Vector chuẩn xác 0.01 mm (Precision Drafting)",
    description:
      "Tự động tính bán kính cung tròn, chừa đường may đồng đều (Seam Allowance), đặt dấu bấm định vị (Notches) và đường canh sợi (Grainline) đúng tiêu chuẩn xưởng may công nghiệp.",
  },
  {
    icon: Layers,
    title: "Nhảy size lồng nhau & Xuất DXF tức thì (Nested Grading)",
    description:
      "Tự động dựng bộ nhảy size S – M – L – XL lồng nhau phân màu trực quan theo công thức (+4 cm vòng eo, +1 cm dài váy), xuất file .DXF đưa thẳng vào máy cắt sơ đồ.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href="/" />

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#compatibility" className="hover:text-[#4F46E5] transition-colors">
              Tương thích CAD
            </a>
            <a href="#capabilities" className="hover:text-[#4F46E5] transition-colors">
              Kiến trúc Engine
            </a>
            <Link href="/templates" className="hover:text-[#4F46E5] transition-colors">
              Thư viện mẫu & Bảng giá
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex font-mono text-[11px]"
            >
              MVP v1.0 • Light CAD
            </Badge>
            <Button asChild size="default" className="shadow-sm">
              <Link href="/studio">
                Mở Studio CAD
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Split-Layout Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-[#E2E8F0]">
          {/* Subtle top-right radial wash */}
          <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-indigo-50/80 blur-3xl" />

          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
              {/* Left Split: Value Proposition & CTAs */}
              <div className="lg:col-span-6 space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-[#4F46E5]">
                  <DraftingCompass className="size-3.5" />
                  Parametric Garment Pattern CAD SaaS • Chuẩn xác 0.01 mm
                </div>

                <div className="space-y-4">
                  <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl lg:text-[44px] lg:leading-[1.12]">
                    Dựng rập may mặc tự động{" "}
                    <span className="text-[#4F46E5]">trong vài giây</span> cho
                    xưởng may hiện đại
                  </h1>
                  <p className="max-w-xl text-base leading-relaxed text-slate-600">
                    Nhập thông số vòng eo, độ dài, góc xòe và chừa đường may —
                    hệ thống tự động tính toán hình học vector chuẩn xác đến{" "}
                    <strong className="font-semibold text-[#0F172A]">
                      0.01 mm
                    </strong>
                    , nhảy size lồng nhau{" "}
                    <strong className="font-semibold text-[#0F172A]">
                      S – M – L – XL
                    </strong>{" "}
                    và xuất file{" "}
                    <strong className="font-semibold text-[#0F172A]">
                      DXF sản xuất
                    </strong>{" "}
                    ngay trên trình duyệt.
                  </p>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <Button asChild size="lg" className="h-12 px-7 text-sm shadow-md shadow-indigo-500/15">
                    <Link href="/studio">
                      <Scissors className="size-4" />
                      Vào Phòng thiết kế CAD (Open Studio)
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-12 px-5 text-sm">
                    <Link href="/templates">
                      <FileCode2 className="size-4 text-[#4F46E5]" />
                      Thư viện mẫu & Bảng giá
                    </Link>
                  </Button>
                </div>

                {/* Key Workshop Metrics */}
                <div className="grid grid-cols-3 gap-4 border-t border-[#E2E8F0] pt-6">
                  <div>
                    <p className="font-mono text-xl font-bold text-[#0F172A]">
                      0.01 mm
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Độ chính xác vector (Vector Precision)
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xl font-bold text-[#4F46E5]">
                      S – XL
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Nhảy size lồng nhau tức thì (Nested Grading)
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xl font-bold text-[#0F172A]">
                      DXF 1:1
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Xuất cắt máy sơ đồ (Plotter Ready)
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Split: Interactive Live CAD Drafting Preview */}
              <div className="lg:col-span-6">
                <HeroCadPreview />
              </div>
            </div>
          </div>
        </section>

        {/* CAD Industry Compatibility Strip */}
        <section
          id="compatibility"
          className="border-b border-[#E2E8F0] bg-[#F8FAFC] py-10"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#4F46E5]">
                  Tương thích hệ sinh thái sản xuất (Industry Compatibility)
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#0F172A]">
                  Xuất file DXF mở trực tiếp trên các phần mềm CAD & 3D hàng đầu
                </h2>
              </div>
              <Badge variant="outline" className="font-mono text-xs bg-white">
                AutoCAD R12 • Millimeters ($INSUNITS=4)
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {COMPATIBLE_SYSTEMS.map((sys) => (
                <div
                  key={sys.name}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs transition-colors hover:border-indigo-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0F172A]">
                      {sys.name}
                    </span>
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    {sys.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Architecture Pillars */}
        <section id="capabilities" className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2 mb-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4F46E5]">
                Kiến trúc kỹ thuật (CAD Architecture)
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
                Thiết kế cho tốc độ của phòng kỹ thuật & xưởng may mẫu
              </h2>
              <p className="text-sm text-slate-600">
                Thay thế thao tác vẽ tay lặp đi lặp lại bằng công thức tham số
                hóa — đảm bảo mọi đường cong, dấu bấm và chừa đường may khớp
                tuyệt đối.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {CORE_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xs transition-all hover:border-indigo-200 hover:shadow-md hover:shadow-slate-200/50"
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5] border border-indigo-100">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-[#0F172A]">
                      {pillar.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {pillar.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Template Plugin Library Showcase */}
        <section
          id="templates"
          className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-16"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end mb-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#4F46E5]">
                  Thư viện Plugin Mẫu rập (Template Engine)
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#0F172A]">
                  Mẫu rập tham số sẵn sàng sản xuất
                </h2>
              </div>
              <Button asChild variant="default">
                <Link href="/studio">
                  <Cpu className="size-4" />
                  Khởi chạy Template Chân váy xòe
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TEMPLATE_CATALOG.map((item) => {
                const isActive = item.status === "active";
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-500">
                          {item.category}
                        </span>
                        <Badge
                          variant={isActive ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {isActive ? "Sẵn sàng (MVP)" : "Sắp ra mắt"}
                        </Badge>
                      </div>
                      <h3 className="mt-2.5 text-sm font-bold text-[#0F172A]">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {item.englishName}
                      </p>
                      <p className="mt-3 font-mono text-[10px] text-slate-400">
                        src/templates/{item.id}/
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      {isActive ? (
                        <Button asChild size="sm" className="w-full">
                          <Link href="/studio">
                            Mở trong Studio
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="w-full text-slate-400"
                        >
                          Đang phát triển (Roadmap)
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo compact href="/" />
            <span className="text-xs text-slate-400">
              • Parametric Garment Pattern CAD Engine (0.01 mm)
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/studio" className="font-semibold text-[#4F46E5] hover:underline inline-flex items-center gap-1">
              <Download className="size-3.5" />
              Mở Studio CAD & Xuất DXF
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
