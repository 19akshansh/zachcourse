import React, { useState, useEffect } from "react";
import { Key, Plus, Trash2, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "../lib/auth-client";
import { useTranslation } from "react-i18next";

export function ApiKeysDashboard() {
  const { t } = useTranslation(["common"]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  
  const [keyToRevoke, setKeyToRevoke] = useState<any | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const { data, error } = await authClient.apiKey.list();
      if (error) {
        toast.error(error.message || "Failed to load API keys");
      } else {
        setApiKeys(data?.apiKeys || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    
    setIsCreating(true);
    try {
      // @ts-ignore
      const { data, error } = await authClient.apiKey.create({
        name: newKeyName.trim()
      });
      if (error) {
        toast.error(error.message || "Failed to create API key");
      } else if (data) {
        setCreatedKey(data.key);
        setNewKeyName("");
        setShowCreateModal(false);
        fetchKeys();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    setIsRevoking(true);
    try {
      // @ts-ignore
      const { error } = await authClient.apiKey.delete({
        keyId: keyToRevoke.id,
      });
      if (error) {
        toast.error(error.message || "Failed to revoke API key");
      } else {
        toast.success("API key revoked.");
        setKeyToRevoke(null);
        fetchKeys();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to revoke API key");
    } finally {
      setIsRevoking(false);
    }
  };

  const copyToClipboard = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setHasCopied(true);
      toast.success("API key copied to clipboard.");
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  const closeCreatedModal = () => {
    setCreatedKey(null);
    setHasCopied(false);
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#FAF9FD] tracking-tight mb-2">API Keys</h1>
          <p className="text-sm text-[#8E88AB] max-w-lg leading-relaxed">
            Create API keys to securely connect ZachCourse with external applications such as Zachmation.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#4F46E5] hover:bg-[#5054D3] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-[#4F46E5]/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-6 md:p-8 shadow-xl mb-8">
        <h2 className="text-lg font-bold text-[#FAF9FD] mb-6 flex items-center gap-2">
          <Key className="w-5 h-5 text-[#818CF8]" />
          Your API Keys
        </h2>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin mb-4" />
            <p className="text-sm text-[#8E88AB]">Loading keys...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-12 bg-[#1A172E]/50 rounded-2xl border border-[#1E1E2E] border-dashed">
            <Key className="w-12 h-12 text-[#2A2443] mx-auto mb-4" />
            <h3 className="text-base font-semibold text-[#FAF9FD] mb-2">No API keys yet</h3>
            <p className="text-sm text-[#8E88AB] max-w-sm mx-auto mb-6">
              Create an API key to connect ZachCourse with Zachmation or another external application.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#1E1E2E] hover:bg-[#2A2443] text-[#FAF9FD] px-4 py-2 rounded-lg font-medium text-sm transition"
            >
              Create API Key
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E1E2E] text-xs font-semibold text-[#8E88AB] uppercase tracking-wider">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-[#1E1E2E] last:border-0 hover:bg-white/[0.02] transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-sm text-[#FAF9FD]">{key.name || "Unnamed Key"}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-[#8E88AB]">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => setKeyToRevoke(key)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-3 py-1.5 rounded-lg text-sm transition font-medium"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl p-6 md:p-8 shadow-xl">
        <h2 className="text-lg font-bold text-[#FAF9FD] mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          How to use API Keys
        </h2>
        <div className="text-sm text-[#8E88AB] space-y-4">
          <p>
            Use this API key when connecting ZachCourse to external services like Zachmation.
            API keys should be treated like passwords and kept secret.
          </p>
          <div className="bg-[#1A172E] border border-[#2A2443] rounded-xl p-4 font-mono text-xs text-[#FAF9FD] space-y-2">
            <div>
              <span className="text-[#818CF8]">Header:</span> x-api-key
            </div>
            <div>
              <span className="text-[#818CF8]">Value:</span> &lt;your API key&gt;
            </div>
          </div>
          <p className="text-xs">
            API requests authenticated with an API key are subject to the configured rate limit of 100 requests per hour.
          </p>
        </div>
      </div>

      {/* CREATE KEY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#0F0D19]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#FAF9FD] mb-2">Create API Key</h3>
              <p className="text-sm text-[#8E88AB] mb-6">Give your API key a recognizable name.</p>
              
              <form onSubmit={handleCreate}>
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[#8E88AB] uppercase tracking-wider mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Zachmation"
                    className="w-full bg-[#1A172E] border border-[#2A2443] rounded-xl px-4 py-2.5 text-[#FAF9FD] text-sm focus:ring-2 focus:ring-[#4F46E5] focus:outline-none transition"
                    required
                    autoFocus
                  />
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-[#8E88AB] hover:text-[#FAF9FD] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newKeyName.trim()}
                    className="bg-[#4F46E5] hover:bg-[#5054D3] text-white px-5 py-2 rounded-xl font-semibold text-sm transition shadow-lg shadow-[#4F46E5]/20 flex items-center justify-center min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Key"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CREATED KEY MODAL */}
      {createdKey && (
        <div className="fixed inset-0 bg-[#0F0D19]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                <Key className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-[#FAF9FD] mb-2">API Key Created</h3>
              <p className="text-sm text-[#8E88AB] mb-6">
                Copy this API key now. For security, the full secret will not be shown again.
              </p>
              
              <div className="bg-[#1A172E] border border-[#2A2443] rounded-xl p-4 flex items-center justify-between gap-4 mb-8">
                <code className="text-[#FAF9FD] text-sm font-mono break-all">{createdKey}</code>
                <button
                  onClick={copyToClipboard}
                  className="shrink-0 bg-[#1E1E2E] hover:bg-[#2A2443] text-[#FAF9FD] p-2 rounded-lg transition"
                  title="Copy to clipboard"
                >
                  {hasCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              
              <button
                onClick={closeCreatedModal}
                className="w-full bg-[#1E1E2E] hover:bg-[#2A2443] text-white px-5 py-3 rounded-xl font-semibold text-sm transition"
              >
                I have copied my key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE KEY MODAL */}
      {keyToRevoke && (
        <div className="fixed inset-0 bg-[#0F0D19]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-[#1E1E2E] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#FAF9FD] mb-2 text-red-400">Revoke API key?</h3>
              <p className="text-sm text-[#8E88AB] mb-6">
                This will immediately prevent applications using this key from accessing your ZachCourse API. This action cannot be undone.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setKeyToRevoke(null)}
                  className="px-4 py-2 text-sm font-medium text-[#8E88AB] hover:text-[#FAF9FD] transition"
                  disabled={isRevoking}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl font-semibold text-sm transition shadow-lg shadow-red-500/20 flex items-center justify-center min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Revoke API Key"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
