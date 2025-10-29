import React from 'react';
import CustomDialogTrigger from '../global/custom-dialog-trigger';
import BannerUploadForm from './banner-upload-form';

interface BannerUploadProps {
  children: React.ReactNode;
  className?: string;
  dirType: 'workspace' | 'file' | 'folder';
  id: string;
  onBannerUpdate?: (bannerUrl: string | null) => void;
}

const BannerUpload: React.FC<BannerUploadProps> = ({
  id,
  dirType,
  children,
  className,
  onBannerUpdate,
}) => {
  return (
    <CustomDialogTrigger
      header="Upload Banner"
      content={
        <BannerUploadForm
          dirType={dirType}
          id={id}
          onBannerUpdate={onBannerUpdate}
        />
      }
      className={className}
    >
      {children}
    </CustomDialogTrigger>
  );
};

export default BannerUpload;
