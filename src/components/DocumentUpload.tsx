import React, { useRef, useState } from "react";
import { Upload, X, FileText, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentUploadProps {
  onExtracted: (text: string, fileNames: string[]) => void;
  onClear: () => void;
  hasDocument: boolean;
}

export function DocumentUpload({ onExtracted, onClear, hasDocument }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; chars: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (files.length > 3) {
      toast.error("Max 3 files allowed.");
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 10MB limit`);
        return;
      }
      formData.append("files", file);
    }

    setIsUploading(true);
    try {
      const res = await fetch("/api/process-documents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes("safety") || data.error?.includes("cannot be safely processed")) {
          toast.error("⚠️ Document flagged for safety — cannot process");
        } else if (data.error === "INVALID_FILE_TYPE") {
          toast.error("Only PDF, .txt, and .md allowed");
        } else {
          toast.error(data.error || "Upload failed");
        }
        return;
      }

      setUploadedFiles(Array.from(files).map(f => ({ name: f.name, chars: data.charCount })));
      onExtracted(data.extractedText, Array.from(files).map(f => f.name));
      toast.success("📄 Documents processed — AI will use them as context");
    } catch (error) {
      toast.error("Network error during upload");
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const clearAll = () => {
    setUploadedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClear();
  };

  if (hasDocument && uploadedFiles.length > 0) {
    return (
      <div className="flex flex-col gap-2 p-4 bg-[#111118] border border-[#2A2443] rounded-2xl mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Documents Ready
          </span>
          <button 
            onClick={clearAll}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
          >
            Clear all
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {uploadedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-[#1A172E] border border-indigo-500/20 px-3 py-1.5 rounded-full text-xs text-indigo-200">
              <FileText className="w-3 h-3 text-indigo-400" />
              <span className="truncate max-w-[150px]">{f.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
      className={`relative p-6 mt-4 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
        isDragging 
          ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
          : "border-[#2A2443] bg-[#1A172E] hover:border-indigo-500/50 hover:bg-[#1E1B36]"
      }`}
    >
      <input 
        type="file" 
        multiple 
        accept=".pdf,.txt,.md" 
        className="hidden" 
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <span className="text-sm font-semibold text-indigo-200">Processing documents...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-[#111118] border border-[#2A2443] flex items-center justify-center">
            <Upload className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#F8FAFC]">Drop PDFs, .txt, or .md files here</p>
            <p className="text-xs font-medium text-[#94A3B8] mt-1">
              Max 10MB per file • 3 files max <br/> Content processed in memory, never stored
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
