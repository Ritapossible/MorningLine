"use client";

import { use } from "react";
import { DealView } from "../../../../components/DealView";
import { PREVIOUS_MORNINGLINE } from "../../../../lib/contracts";

/// Deals on the first contract, read-only, so their settled history stays visible.
export default function FirstContractDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DealView id={id} contract={{ address: PREVIOUS_MORNINGLINE, version: 1 }} />;
}
