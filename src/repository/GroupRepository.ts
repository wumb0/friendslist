import { Group } from '../types/Group';

export interface GroupRepository {
  getAll(): Promise<Group[]>;
  save(group: Group): Promise<void>;
  delete(id: string): Promise<void>;
}
