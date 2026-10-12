import { blogGenerate, blogTrackProcess } from './blog'
import { imageGenerate, imageTrackProcess } from './image'
import { socialPublish } from './social'
import { failJobOnCancelledRun } from './runCancelled'
import { sweepStalledWork } from './sweeper'
import { videoGenerate, videoApprove, videoTrackRender } from './video'

export const functions = [
  blogGenerate,
  blogTrackProcess,
  imageGenerate,
  imageTrackProcess,
  socialPublish,
  videoGenerate,
  videoApprove,
  videoTrackRender,
  sweepStalledWork,
  failJobOnCancelledRun,
]
