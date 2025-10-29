'use client';
import { useAppState } from '@/lib/providers/state-provider';
import React, { useState, useCallback } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Upload, Link, Image as ImageIcon, X } from 'lucide-react';
import Loader from '../global/Loader';
import { updateFile, getFile } from '@/lib/queries';

interface BannerUploadFormProps {
  dirType: 'workspace' | 'file' | 'folder';
  id: string;
  onBannerUpdate?: (bannerUrl: string | null) => void;
}

const BannerUploadForm: React.FC<BannerUploadFormProps> = ({ dirType, id, onBannerUpdate }) => {
  const { workspaceId, folderId, dispatch } = useAppState();
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const validateImageUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim() || !id) return;

    try {
      setError(null);
      setIsUploading(true);

      if (!validateImageUrl(imageUrl)) {
        throw new Error('Please enter a valid HTTP/HTTPS URL');
      }

      if (dirType !== 'file') {
        throw new Error('Banner can only be set for files');
      }

      if (!workspaceId || !folderId) throw new Error('Missing workspace/folder context');

      // Get current file data to include required fields
      const currentFile = await getFile(id);
      const bannerUrl = imageUrl.trim();
      
      await updateFile(id, { 
        ...currentFile,
        bannerUrl, 
        workspaceId, 
        folderId 
      });
      
      dispatch({
        type: 'UPDATE_FILE',
        payload: {
          file: { bannerUrl },
          fileId: id,
          folderId,
          workspaceId,
        },
      });

      setPreviewUrl(imageUrl);
      setImageUrl('');
      onBannerUpdate?.(bannerUrl);
      console.log('Banner URL set successfully:', bannerUrl);
    } catch (error) {
      console.error('Failed to set banner URL', error);
      setError(error instanceof Error ? error.message : 'Failed to set banner URL');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file || !id) return;

    try {
      setError(null);
      setIsUploading(true);

      // Basic validations
      if (!(file.type && file.type.startsWith('image/'))) {
        throw new Error('Please select a valid image file');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      if (dirType !== 'file') {
        throw new Error('Banner can only be set for files');
      }

      if (!workspaceId || !folderId) throw new Error('Missing workspace/folder context');

      // Get current file data to include required fields
      const currentFile = await getFile(id);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = (err) => reject(err);
      });

      await updateFile(id, { 
        ...currentFile,
        bannerUrl: base64, 
        workspaceId, 
        folderId 
      });
      
      dispatch({
        type: 'UPDATE_FILE',
        payload: {
          file: { bannerUrl: base64 },
          fileId: id,
          folderId,
          workspaceId,
        },
      });

      // Create preview URL
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
      onBannerUpdate?.(base64);
      console.log('Banner uploaded successfully as base64');
    } catch (error) {
      console.error('Failed to upload banner', error);
      setError(error instanceof Error ? error.message : 'Failed to upload banner');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Tabs defaultValue="url" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Image URL
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="text-sm font-medium">
                    Image URL
                  </Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={isUploading}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a direct link to an image (PNG, JPEG, WebP)
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!imageUrl.trim() || isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader />
                      Setting Banner...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Set Banner
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <div className="space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium text-primary">Click to upload</span> or drag and drop
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG, WebP up to 5MB
                  </p>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-4">
                  {error}
                </div>
              )}

              {isUploading && (
                <div className="flex items-center justify-center py-4">
                  <Loader />
                  <span className="text-sm ml-2">Uploading...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {previewUrl && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Banner preview"
                  className="w-full h-32 object-cover rounded border"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                  onClick={() => {
                    setPreviewUrl(null);
                    if (previewUrl.startsWith('blob:')) {
                      URL.revokeObjectURL(previewUrl);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BannerUploadForm;
