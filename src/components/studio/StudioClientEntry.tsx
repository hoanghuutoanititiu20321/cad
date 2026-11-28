"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { CadStudio } from "./CadStudio";

export function StudioClientEntry() {
  const searchParams = useSearchParams();
  const initialTemplate = searchParams.get("template") ?? "circle-skirt";
  return <CadStudio key={initialTemplate} initialTemplateId={initialTemplate} />;
}
