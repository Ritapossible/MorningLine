"use client";

import { use } from "react";
import { DealView } from "../../../components/DealView";
import { MORNINGLINE } from "../../../lib/contracts";

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DealView id={id} contract={{ address: MORNINGLINE, version: 2 }} />;
}
