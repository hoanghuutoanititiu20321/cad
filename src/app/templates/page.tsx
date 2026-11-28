import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  DraftingCompass,
  Layers,
  Scissors,
  User,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { TemplateThumbnail } from "@/components/templates/TemplateThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TEMPLATE_CATALOG } from "@/templates/registry";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Thư viện phom mẫu & Bảng giá (Templates & Pricing) — PatternCAD Pro",
  description:
    "Khám phá thư viện mẫu rập tham số chuẩn công nghiệp và các gói SaaS dành cho cá nhân, thợ rập chuyên nghiệp và xưởng sản xuất may mặc.",
};

const SAAS_PLANS = [
  {
    id: "free",
    name: "Miễn phí",
    englishName: "Starter / Free",
    price: "0đ",
    period: "/ tháng",
    description:
      "Dành cho sinh viên thiết kế thời trang và thợ may muốn trải nghiệm dựng rập tham số.",
    badge: null,
    highlighted: false,
    icon: User,
    ctaLabel: "Bắt đầu miễn phí",
    ctaHref: "/studio",
    features: [
      "Truy cập mẫu Chân váy xòe (90° – 360°)",
      "Dựng rập vector 2D & công thức Realtime",
      "Xuất file in thử nghiệm PDF A4 ghép trang",
      "Chế độ xem nhảy size S – M – L – XL",
    ],
  },
  {
    id: "pro",
    name: "Pro Thợ Rập",
    englishName: "Patternmaker Pro",
    price: "490.000đ",
    period: "/ tháng",
    description:
      "Giải pháp toàn diện cho thợ rập freelance, thương hiệu local brand và studio thiết kế.",
    badge: "Phổ biến nhất",
    highlighted: true,
    icon: DraftingCompass,
    ctaLabel: "Dùng thử Studio Pro",
    ctaHref: "/studio",
    features: [
      "Mở khóa toàn bộ Thư viện phom mẫu",
      "Xuất DXF chuẩn AAMA (Layer 1, 4, 7, 8, 11)",
      "Tương thích Gerber AccuMark, Optitex, CLO3D",
      "Xuất PDF A0 máy vẽ sơ đồ & gói Tech Pack .ZIP",
      "Xuất lồng nhiều size (S – XL) tỷ lệ 1:1 (mm/cm)",
    ],
  },
  {
    id: "factory",
    name: "Xưởng Sản Xuất",
    englishName: "Factory / Enterprise",
    price: "1.490.000đ",
    period: "/ tháng",
    description:
      "Thiết kế cho phòng kỹ thuật xưởng may công nghiệp cần đồng bộ bảng size và quy trình cắt.",
    badge: "Đa tài khoản",
    highlighted: false,
    icon: Building2,
    ctaLabel: "Liên hệ triển khai xưởng",
    ctaHref: "/studio",
    features: [
      "Bao gồm toàn bộ tính năng Pro Thợ Rập",
      "Tối đa 10 tài khoản kỹ thuật viên (Team)",
      "Tùy biến bảng thông số & bước nhảy size riêng",
      "API xuất DXF / Tech Pack tích hợp ERP xưởng",
      "Hỗ trợ thiết kế Template riêng theo mã hàng",
    ],
  },
];

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href="/" />

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-[#4F46E5] transition-colors">
              Trang chủ
            </Link>
            <Link
              href="/templates"
              className="font-semibold text-[#4F46E5]"
            >
              Thư viện mẫu
            </Link>
            <a
              href="#pricing"
              className="hover:text-[#4F46E5] transition-colors"
            >
              Bảng giá SaaS
            </a>
          </nav>

          <Button asChild size="default" className="shadow-sm">
            <Link href="/studio">
              Mở Studio CAD
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Page Header */}
        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC] py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl space-y-2.5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-[#4F46E5]">
                  <Layers className="size-3.5" />
                  Modular Template Engine • Thư viện phom mẫu
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
                  Thư viện phom mẫu tham số (Pattern Library)
                </h1>
                <p className="text-sm leading-relaxed text-slate-600">
                  Mỗi phom mẫu được lập trình theo chuẩn toán học hình học phẳng
                  0.01 mm, sẵn sàng nhảy size S–XL và xuất trực tiếp sang DXF
                  (Gerber, Optitex, CLO3D), PDF A0 và PDF A4 ghép trang.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Badge variant="success">2 mẫu sẵn sàng (Active)</Badge>
                <Badge variant="secondary">2 mẫu sắp ra mắt</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Template Grid */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {TEMPLATE_CATALOG.map((item) => {
                const isActive = item.status === "active";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-2xl border bg-white transition-all",
                      isActive
                        ? "border-indigo-200 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/10"
                        : "border-[#E2E8F0] shadow-2xs"
                    )}
                  >
                    {/* Visual CAD Wireframe Thumbnail */}
                    <div className="relative h-48 w-full border-b border-[#E2E8F0] bg-white cad-grid-bg p-4">
                      <TemplateThumbnail templateId={item.id} />
                      <div className="absolute top-3 left-3">
                        <Badge
                          variant={isActive ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {isActive ? "Đang hoạt động (Active)" : "Sắp ra mắt"}
                        </Badge>
                      </div>
                      <span className="absolute bottom-2.5 right-3 rounded bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 border border-[#E2E8F0]">
                        {item.category}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <h2 className="text-base font-bold text-[#0F172A]">
                          {item.name}
                        </h2>
                        <p className="text-xs font-medium text-slate-400">
                          {item.englishName}
                        </p>
                        <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                          {item.description}
                        </p>

                        <ul className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                          {item.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-1.5">
                              <Check className="mt-0.5 size-3 shrink-0 text-[#4F46E5]" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100">
                        {isActive ? (
                          <Button asChild className="w-full shadow-xs">
                            <Link href={`/studio?template=${item.id}`}>
                              <Scissors className="size-3.5" />
                              Mở trong Studio CAD
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            disabled
                            className="w-full text-slate-400"
                          >
                            <Clock className="size-3.5" />
                            Coming Soon
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SaaS Pricing Section */}
        <section
          id="pricing"
          className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-16"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center space-y-2.5 mb-12">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4F46E5]">
                Bảng giá dịch vụ (SaaS Pricing)
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
                Chọn gói phù hợp cho thợ rập & xưởng sản xuất
              </h2>
              <p className="text-sm text-slate-600">
                Tiết kiệm 90% thời gian dựng rập và nhảy size thủ công. Nâng cấp
                hoặc hủy gói linh hoạt bất kỳ lúc nào.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {SAAS_PLANS.map((plan) => {
                const Icon = plan.icon;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col justify-between rounded-2xl border bg-white p-7 transition-all",
                      plan.highlighted
                        ? "border-[#4F46E5] shadow-xl shadow-indigo-500/10 ring-1 ring-[#4F46E5]"
                        : "border-[#E2E8F0] shadow-2xs"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex size-9 items-center justify-center rounded-xl border",
                              plan.highlighted
                                ? "border-indigo-200 bg-indigo-50 text-[#4F46E5]"
                                : "border-[#E2E8F0] bg-slate-50 text-slate-700"
                            )}
                          >
                            <Icon className="size-4.5" />
                          </span>
                          <div>
                            <h3 className="text-base font-bold text-[#0F172A]">
                              {plan.name}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              {plan.englishName}
                            </p>
                          </div>
                        </div>
                        {plan.badge && (
                          <Badge
                            variant={plan.highlighted ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {plan.badge}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-6 flex items-baseline gap-1">
                        <span className="font-mono text-3xl font-bold tracking-tight text-[#0F172A]">
                          {plan.price}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {plan.period}
                        </span>
                      </div>

                      <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                        {plan.description}
                      </p>

                      <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 text-xs text-slate-700">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-[#4F46E5]" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-8">
                      <Button
                        asChild
                        size="lg"
                        variant={plan.highlighted ? "default" : "outline"}
                        className="w-full"
                      >
                        <Link href={plan.ctaHref}>
                          {plan.ctaLabel}
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo compact href="/" />
            <span className="text-xs text-slate-400">
              • Parametric Garment Pattern CAD SaaS
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <Link href="/" className="hover:text-[#4F46E5]">
              Trang chủ
            </Link>
            <Link href="/studio" className="font-semibold text-[#4F46E5] hover:underline">
              Mở Studio CAD
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
