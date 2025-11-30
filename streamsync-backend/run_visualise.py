#!/usr/bin/python
# -*- coding: utf-8 -*-

import torch
import numpy
import time, pdb, argparse, subprocess, pickle, os, glob
import cv2

from scipy import signal

# ==================== PARSE ARGUMENT ====================

parser = argparse.ArgumentParser(description="SyncNet")
parser.add_argument('--data_dir', type=str, default='data/work', help='')
parser.add_argument('--videofile', type=str, default='', help='')
parser.add_argument('--reference', type=str, default='', help='')
parser.add_argument('--frame_rate', type=int, default=25, help='Frame rate')
opt = parser.parse_args()

setattr(opt, 'avi_dir', os.path.join(opt.data_dir, 'pyavi'))
setattr(opt, 'tmp_dir', os.path.join(opt.data_dir, 'pytmp'))
setattr(opt, 'work_dir', os.path.join(opt.data_dir, 'pywork'))
setattr(opt, 'crop_dir', os.path.join(opt.data_dir, 'pycrop'))
setattr(opt, 'frames_dir', os.path.join(opt.data_dir, 'pyframes'))

# ==================== LOAD FILES ====================

with open(os.path.join(opt.work_dir, opt.reference, 'tracks.pckl'), 'rb') as fil:
    tracks = pickle.load(fil, encoding='latin1')

with open(os.path.join(opt.work_dir, opt.reference, 'activesd.pckl'), 'rb') as fil:
    dists = pickle.load(fil, encoding='latin1')

flist = glob.glob(os.path.join(opt.frames_dir, opt.reference, '*.jpg'))
flist.sort()

# ==================== SMOOTH FACES ====================

faces = [[] for _ in range(len(flist))]

for tidx, track in enumerate(tracks):

    mean_dists = numpy.mean(numpy.stack(dists[tidx], 1), 1)
    minidx = numpy.argmin(mean_dists, 0)
    minval = mean_dists[minidx]

    fdist = numpy.stack([dist[minidx] for dist in dists[tidx]])
    fdist = numpy.pad(fdist, (3, 3), 'constant', constant_values=10)

    fconf = numpy.median(mean_dists) - fdist
    fconfm = signal.medfilt(fconf, kernel_size=9)

    frame_list = track['track']['frame'].tolist()

    for fidx, frame in enumerate(frame_list):

        # SAFE GUARDS TO PREVENT OUT OF RANGE INDEX
        if (
            fidx >= len(fconfm) or
            fidx >= len(track['proc_track']['s']) or
            fidx >= len(track['proc_track']['x']) or
            fidx >= len(track['proc_track']['y'])
        ):
            continue

        faces[frame].append({
            'track': tidx,
            'conf': fconfm[fidx],
            's': track['proc_track']['s'][fidx],
            'x': track['proc_track']['x'][fidx],
            'y': track['proc_track']['y'][fidx]
        })

# ==================== ADD DETECTIONS TO VIDEO ====================

first_image = cv2.imread(flist[0])
fw = first_image.shape[1]
fh = first_image.shape[0]

fourcc = cv2.VideoWriter_fourcc(*'XVID')
vOut = cv2.VideoWriter(
    os.path.join(opt.avi_dir, opt.reference, 'video_only.avi'),
    fourcc, opt.frame_rate, (fw, fh)
)

for fidx, fname in enumerate(flist):

    image = cv2.imread(fname)

    for face in faces[fidx]:

        # Skip invalid or NaN entries
        if (
            face['s'] is None or face['x'] is None or face['y'] is None or face['conf'] is None or
            numpy.isnan(face['s']) or numpy.isnan(face['x']) or numpy.isnan(face['y']) or numpy.isnan(face['conf'])
        ):
            continue

        if face['s'] <= 0:
            continue

        # Safe numeric color
        clr = face['conf'] * 25
        if numpy.isnan(clr):
            continue

        clr = int(max(min(clr, 255), 0))

        x1 = int(face['x'] - face['s'])
        y1 = int(face['y'] - face['s'])
        x2 = int(face['x'] + face['s'])
        y2 = int(face['y'] + face['s'])

        if any(numpy.isnan(v) for v in [x1, y1, x2, y2]):
            continue

        cv2.rectangle(image, (x1, y1), (x2, y2), (0, clr, 255 - clr), 3)

        cv2.putText(
            image,
            'Track %d, Conf %.3f' % (face['track'], face['conf']),
            (x1, y1),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            2
        )

    vOut.write(image)
    print('Frame %d' % fidx)

vOut.release()

# ========== COMBINE AUDIO AND VIDEO FILES ==========

command = (
    "ffmpeg -y -i %s -i %s -c:v copy -c:a copy %s" %
    (
        os.path.join(opt.avi_dir, opt.reference, 'video_only.avi'),
        os.path.join(opt.avi_dir, opt.reference, 'audio.wav'),
        os.path.join(opt.avi_dir, opt.reference, 'video_out.avi')
    )
)

subprocess.call(command, shell=True, stdout=None)
