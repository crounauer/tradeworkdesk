"use client";

interface Props {
  content: {
    height?: number;
  } & Record<string, unknown>;
}

export default function SpacerBlock({ content }: Props) {
  const { height = 48 } = content;
  return <div style={{ height }} aria-hidden="true" />;
}
