import {ConfigTemplateEntry} from '../../../../common/entities/job/JobDTO';
import {Job} from './Job';
import * as path from 'path';
import {DiskManager} from '../../DiskManger';
import {DiskMangerWorker} from '../../threading/DiskMangerWorker';
import {Logger} from '../../../Logger';
import {Config} from '../../../../common/config/private/Config';
import {ServerConfig} from '../../../../common/config/private/IPrivateConfig';
import {FileDTO} from '../../../../common/entities/FileDTO';
import {SQLConnection} from '../../database/sql/SQLConnection';
import {MediaEntity} from '../../database/sql/enitites/MediaEntity';
import {PhotoEntity} from '../../database/sql/enitites/PhotoEntity';
import {VideoEntity} from '../../database/sql/enitites/VideoEntity';
import DatabaseType = ServerConfig.DatabaseType;

declare var global: NodeJS.Global;


const LOG_TAG = '[FileJob]';


export abstract class FileJob<S extends { indexedOnly: boolean } = { indexedOnly: boolean }> extends Job<S> {
  public readonly ConfigTemplate: ConfigTemplateEntry[] = [];
  directoryQueue: string[] = [];
  fileQueue: FileDTO[] = [];


  protected constructor(private scanFilter: DiskMangerWorker.DirectoryScanSettings) {
    super();
    if (Config.Server.Database.type !== DatabaseType.memory) {
      this.ConfigTemplate.push({
        id: 'indexedOnly',
        type: 'boolean',
        name: 'Only indexed files',
        defaultValue: true
      });
    }
  }

  protected async init() {
    this.directoryQueue = [];
    this.fileQueue = [];
    this.directoryQueue.push('/');
  }

  protected async filterMediaFiles(files: FileDTO[]): Promise<FileDTO[]> {
    return files;
  }


  protected async filterMetaFiles(files: FileDTO[]): Promise<FileDTO[]> {
    return files;
  }

  protected abstract async shouldProcess(file: FileDTO): Promise<boolean>;
  protected abstract async processFile(file: FileDTO): Promise<void>;

  protected async step(): Promise<boolean> {
    if (this.directoryQueue.length === 0 && this.fileQueue.length === 0) {
      return false;
    }

    if (this.directoryQueue.length > 0) {

      if (this.config.indexedOnly === true &&
        Config.Server.Database.type !== DatabaseType.memory) {
        await this.loadAllMediaFilesFromDB();
        this.directoryQueue = [];
      } else {
        await this.loadADirectoryFromDisk();
      }
    } else if (this.fileQueue.length > 0) {
      this.Progress.Left = this.fileQueue.length;
      const file = this.fileQueue.shift();
      const filePath = path.join(file.directory.path, file.directory.name, file.name);
      try {
        if ((await this.shouldProcess(file)) === true) {
          this.Progress.Processed++;
          this.Progress.log('processing: ' + filePath);
          await this.processFile(file);
        } else {
        this.Progress.log('skipping: ' + filePath);
          this.Progress.Skipped++;
        }
      } catch (e) {
        console.error(e);
        Logger.error(LOG_TAG, 'Error during processing file:' + filePath + ', ' + e.toString());
        this.Progress.log('Error during processing file:' + filePath + ', ' + e.toString());
      }
    }
    return true;
  }

  private async loadADirectoryFromDisk() {
    const directory = this.directoryQueue.shift();
    this.Progress.log('scanning directory: ' + directory);
    const scanned = await DiskManager.scanDirectory(directory, this.scanFilter);
    for (let i = 0; i < scanned.directories.length; i++) {
      this.directoryQueue.push(path.join(scanned.directories[i].path, scanned.directories[i].name));
    }
    if (this.scanFilter.noVideo !== true || this.scanFilter.noVideo !== true) {
      this.fileQueue.push(...await this.filterMediaFiles(scanned.media));
    }
    if (this.scanFilter.noMetaFile !== true) {
      this.fileQueue.push(...await this.filterMetaFiles(scanned.metaFile));
    }
  }

  private async loadAllMediaFilesFromDB() {

    if (this.scanFilter.noVideo === true && this.scanFilter.noPhoto === true) {
      return;
    }
    this.Progress.log('Loading files from db');
    Logger.silly(LOG_TAG, 'Loading files from db');

    const connection = await SQLConnection.getConnection();

    let usedEntity = MediaEntity;

    if (this.scanFilter.noVideo === true) {
      usedEntity = PhotoEntity;
    } else if (this.scanFilter.noPhoto === true) {
      usedEntity = VideoEntity;
    }

    const result = await connection
      .getRepository(usedEntity)
      .createQueryBuilder('media')
      .select(['media.name', 'media.id'])
      .leftJoinAndSelect('media.directory', 'directory')
      .getMany();

    this.fileQueue.push(...await this.filterMediaFiles(result));
  }
}
