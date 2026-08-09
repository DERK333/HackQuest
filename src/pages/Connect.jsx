import React, { useState } from 'react';
import { Plug, Copy, Check, Bot, MessagesSquare, MousePointer2, TerminalSquare, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can select the read-only field instead */
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="min-h-[44px] gap-2">
      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{n}</span>
      <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}

export default function Connect() {
  const mcpUrl = new URL("/api/mcp", window.location.origin).toString();

  return (
    <div className="max-w-3xl mx-auto py-4 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Plug className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Connect an AI assistant</h1>
          <p className="text-muted-foreground mt-1">
            Point Claude, ChatGPT, Cursor, or any MCP-compatible client at your HackQuest data. The assistant only ever acts as you — it can read and do exactly what your account allows.
          </p>
        </div>
      </div>

      {/* Server URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCP server URL</CardTitle>
          <CardDescription>Copy this into the client you choose below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
            <code className="flex-1 text-sm font-mono text-foreground truncate">{mcpUrl}</code>
            <CopyButton value={mcpUrl} />
          </div>
        </CardContent>
      </Card>

      {/* Client tabs */}
      <Tabs defaultValue="claude">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="claude" className="gap-1.5"><Bot className="w-4 h-4" />Claude</TabsTrigger>
          <TabsTrigger value="chatgpt" className="gap-1.5"><MessagesSquare className="w-4 h-4" />ChatGPT</TabsTrigger>
          <TabsTrigger value="cursor" className="gap-1.5"><MousePointer2 className="w-4 h-4" />Cursor</TabsTrigger>
          <TabsTrigger value="custom" className="gap-1.5"><TerminalSquare className="w-4 h-4" />Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="claude" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> Claude</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step n={1}>Open the <strong>profile menu</strong> (top-right) → <strong>Settings</strong> → <strong>Connectors</strong>.</Step>
                <Step n={2}>Click <strong>Add custom connector</strong>.</Step>
                <Step n={3}>Give it a name (e.g. <em>HackQuest</em>) and paste the MCP server URL above.</Step>
                <Step n={4}>Click <strong>Add</strong>. Claude will open our consent page — sign in with your HackQuest account and approve.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chatgpt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MessagesSquare className="w-5 h-5 text-primary" /> ChatGPT</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step n={1}>Go to <strong>Apps</strong> and enable <strong>Developer mode</strong> (acknowledge the risk ChatGPT warns about).</Step>
                <Step n={2}>Click <strong>Create app</strong>.</Step>
                <Step n={3}>Name it (e.g. <em>HackQuest</em>) and paste the MCP server URL above.</Step>
                <Step n={4}>Click <strong>Create</strong>, then enable the app from the chat composer before prompting it.</Step>
                <Step n={5}>ChatGPT opens our consent page — sign in with your HackQuest account and approve.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cursor" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MousePointer2 className="w-5 h-5 text-primary" /> Cursor</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step n={1}>Open <strong>Settings</strong> → <strong>Tools &amp; Integrations</strong> → <strong>New MCP Server</strong>. This opens your <code className="text-xs font-mono">mcp.json</code>.</Step>
                <Step n={2}>Add an entry whose <code className="text-xs font-mono">url</code> is the MCP server URL above, e.g.:</Step>
              </ol>
              <pre className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 text-xs font-mono overflow-x-auto"><code>{`{
  "mcpServers": {
    "hackquest": {
      "url": "${mcpUrl}"
    }
  }
}`}</code></pre>
              <ol className="space-y-3 mt-3">
                <Step n={3}>Save the file and toggle the server on.</Step>
                <Step n={4}>Cursor opens our consent page — sign in with your HackQuest account and approve.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><TerminalSquare className="w-5 h-5 text-primary" /> Custom client</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step n={1}>Copy the MCP server URL above.</Step>
                <Step n={2}>Add it as a <strong>streamable HTTP MCP server</strong>. A name + URL is all most clients need.</Step>
                <Step n={3}>Reload the client so it picks up the new server.</Step>
                <Step n={4}>On first use it opens our consent page — sign in with your HackQuest account and approve.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">It acts as you</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Each client signs you in with your own HackQuest account on our consent page. The assistant can read and do exactly what you can — no more.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex gap-3">
            <RefreshCw className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Refresh after changes</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Assistants cache the tool list. If we add or change tools, refresh the connector in your client so it picks them up.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}