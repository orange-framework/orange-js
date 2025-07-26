"use client";

import React from "react";

export class ErrorBoundary extends React.Component<{
  children: React.ReactNode;
  fallback: (props: { error: Error | null }) => React.ReactNode;
}> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error: process.env.NODE_ENV === "development" ? error : null,
    };
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

export function ErrorFallback({ error }: { error: Error | null }) {
  let content;
  if (process.env.NODE_ENV === "development") {
    if (error?.stack) {
      content = error.stack.toString();
    } else if (error) {
      content = error.toString();
    } else {
      content = "<Unknown error>";
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        fontFamily: "monospace",
      }}
    >
      <style>{`
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>
      <h1>Something went wrong</h1>
      {content && (
        <pre
          style={{
            fontSize: "12px",
            maxWidth: "800px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            textWrap: "wrap",
            background: "#eee",
            padding: "10px",
            borderRadius: "0.5rem",
            overflowWrap: "anywhere",
          }}
        >
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
}
