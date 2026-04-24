import Link from "next/link";
import { Button } from "@repo/ui/components/button";
import { Brain, MessageSquare, Search, FileText, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Recallio</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            <Brain className="h-4 w-4" />
            Your personal AI knowledge base
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Save anything
            <br />
            <span className="text-primary">Ask everything</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Add links, YouTube videos, notes and files to your knowledge base.
            Then chat with your content using AI — get answers, summaries, and
            insights instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Get started for free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          <div className="rounded-lg border p-6 text-left space-y-3">
            <FileText className="h-6 w-6 text-primary" />
            <h3 className="font-semibold">Save anything</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Links, YouTube videos, PDFs, images, notes — everything goes into
              one place.
            </p>
          </div>
          <div className="rounded-lg border p-6 text-left space-y-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h3 className="font-semibold">Chat with your content</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask questions and get answers grounded in your own saved content,
              not the open internet.
            </p>
          </div>
          <div className="rounded-lg border p-6 text-left space-y-3">
            <Search className="h-6 w-6 text-primary" />
            <h3 className="font-semibold">Semantic search</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Find anything by meaning, not just keywords. Search the way you
              think.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
        Made with ❤️
      </footer>
    </div>
  );
}