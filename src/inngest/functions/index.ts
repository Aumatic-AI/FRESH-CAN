import { blogGenerate, blogTrackProcess } from './blog'
import { imageGenerate, imageTrackProcess } from './image'
import { socialPublish } from './social'
import { singleShotGenerate, singleShotRender, singleShotFrenchTrack } from './singleShot'
import { failJobOnCancelledRun } from './runCancelled'
import { sweepStalledWork } from './sweeper'
import { videoGenerate, videoApprove, videoTrackRender } from './video'

export const functions = [
  blogGenerate,
  blogTrackProcess,
  imageGenerate,
  imageTrackProcess,
  socialPublish,
  singleShotGenerate,
  singleShotRender,
  singleShotFrenchTrack,
  videoGenerate,
  videoApprove,
  videoTrackRender,
  sweepStalledWork,
  failJobOnCancelledRun,
]
