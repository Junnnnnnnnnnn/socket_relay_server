import { Injectable } from '@nestjs/common';

@Injectable()
export class SocketService {
  public queue = new Map<string, string[]>();

  getQueue(project: string) {
    if (!this.queue.has(project)) {
      return [];
    }
    return this.queue.get(project)!;
  }

  addToQueue(project: string, socketId: string) {
    if (!this.queue.has(project)) {
      this.queue.set(project, []);
    }
    const projectQueue = this.queue.get(project)!;
    // 중복 방지
    if (!projectQueue.includes(socketId)) {
      projectQueue.push(socketId);
    }
  }

  removeFromQueue(project: string, socketId: string) {
    if (!this.queue.has(project)) {
      return;
    }

    if (!this.queue.get(project)!.includes(socketId)) {
      return;
    }

    this.queue
      .get(project)!
      .splice(this.queue.get(project)!.indexOf(socketId), 1);
  }

  resetQueue(project: string) {
    this.queue.set(project, []);
  }
}
