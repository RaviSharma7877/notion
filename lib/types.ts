import { Socket, Server as NetServer } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';
import { z } from 'zod';

export const FormSchema = z.object({
  email: z.string().describe('Email').email({ message: 'Invalid Email' }),
  password: z.string().describe('Password').min(1, 'Password is required'),
});

export const CreateWorkspaceFormSchema = z.object({
  workspaceName: z
    .string()
    .describe('Workspace Name')
    .min(1, 'Workspace name must be min of 1 character'),
  logo: z.any().optional(),
});

export const UploadBannerFormSchema = z.object({
  banner: z
    .any()
    .refine(
      (value) => {
        if (typeof FileList === 'undefined') {
          return value !== null && value !== undefined;
        }
        return value instanceof FileList && value.length > 0;
      },
      'Banner Image is required'
    ),
});

export type NextApiResponseServerIo = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};
