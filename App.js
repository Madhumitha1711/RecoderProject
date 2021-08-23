import * as React from 'react';
import {
  Dimensions,
  Image,
  Slider, TouchableHighlight,
  Text, View, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, TextInput
} from 'react-native';
import { Button, Card, Menu } from 'react-native-paper';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator()

//App startup - entry point
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#ffcc99' } }}>
        <Stack.Screen name="RECORDER" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeScreen() {
  const [recording, setRecording] = React.useState();
  const [filesList, setFileList] = React.useState([{}]);
  const [fileName, setFileName] = React.useState();
  const [sound, setSound] = React.useState();
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [metering, setMetering] = React.useState(0);
  const [threshold, setThreshold] = React.useState(90);
  const [compress, setCompress] = React.useState(4);

  const [recordingSettings, setRecordingSettings] = React.useState(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
  const [isPlaying, setIsplaying] = React.useState(false);

  //On Component load
  React.useEffect(() => {
    getFileList();
    return sound
      ? () => {
        sound.unloadAsync();
      }
      : undefined;
  }, [getFileList])

  //Get list of audio files in document directory 
  const getFileList = React.useCallback(async () => {
    let list = [];
    let dir = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    dir.forEach((val) => {
      let path = FileSystem.documentDirectory + val

      FileSystem.getInfoAsync(path).then((info) => {
        list.push({
          id: val,
          pathF: path,
          name: val,
          duration: 0,
          ts: info.modificationTime,
          playDuration: null,
          isPlaying: false
        });
        setFileList(list);
      }
      );
    });
  }, [])


  //Listner function called while recording
  updateScreenForRecordingStatus = (status) => {
    if (status.canRecord) {
      setRecordingDuration(status.durationMillis);
      setIsRecording(status.isRecording);
      console.log("Meteringval-->" + status.metering);
      setMetering(status.metering);


    } else if (status.isDoneRecording) {
      setRecordingDuration(0),
        setIsRecording(false);
      setMetering(status.metering);
    };
  }

  //Start recording function
  async function startRecording() {
    try {
      console.log('Requesting permissions..');
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      console.log('Starting recording..');
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingSettings);
      recording.setOnRecordingStatusUpdate(updateScreenForRecordingStatus);
      setRecording(recording);
      console.log('Recording started');
      await recording.startAsync();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  //Function to get recording times
  function getRecordingTimestamp() {
    if (recordingDuration != null) {
      return getMMSSFromMillis(recordingDuration);
    }
    return getMMSSFromMillis(0);
  }
  function getMMSSFromMillis(millis) {

    console.log("millies--->" + millis)
    const totalSeconds = millis / 1000;
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor(totalSeconds / 60);

    const padWithZero = (number) => {
      const string = number.toString();
      if (number < 10) {
        return "0" + string;
      }
      return string;
    };
    return padWithZero(minutes) + ":" + padWithZero(seconds);
  }

  //On stop recording ,audio file copied from cache dir to permanent storage
  async function stopRecording() {
    console.log('Stopping recording..');
    await setFileName("");
    await setRecordingDuration(null);
    await setRecording(undefined);
    await recording.stopAndUnloadAsync();
    const extension = Platform.OS === 'android' ? '.m4a' : '.caf'
    const uri = recording.getURI();
    const newFileUri = FileSystem.documentDirectory + fileName + extension;
    console.log('Recording stopped and stored at', uri);
    console.log('document dir :' + newFileUri);
    FileSystem.copyAsync({
      from: uri,
      to: newFileUri,
    }).then(() => {
      FileSystem.getInfoAsync(newFileUri, { size: true }).then(
        (asset) => {
          if (asset.exists) {
            console.log('file saved from asset. . . : ', asset)
          }
        });
      getFileList();
    })
  }
  const renderItem = ({ item }) => (
    <Item title={item.name} path={item.pathF} duration={item.duration} playDuration={item.playDuration} isPlaying={item.isPlaying} />
  );

  //Callback fn while playing sound
  async function onPlaybackStatusUpdate(status) {
    let fsCopy = [...filesList]
    fsCopy.forEach(item => {
      console.log("uri-->" + item.pathF.uri)
      if (item.pathF == "file://" + status.uri) {
        if (status.isPlaying) {
          item.playDuration = status.durationMillis - status.positionMillis
          item.isPlaying = true;
          item.duration = status.durationMillis

        }
        else {
          item.playDuration = 0;
          item.isPlaying = false;
          item.duration = 0
        }
      }
    })
    setFileList(fsCopy);
    console.log("fs copy-->" + JSON.stringify(fsCopy));

    console.log("SOUND STATUS -->" + JSON.stringify(status));
  }

  async function updatePlayback(value, path) {
    let fsCopy = [...filesList]
    fsCopy.forEach(item => {
      if (item.pathF == path) {
        item.playDuration = status.durationMillis - value;
      }
    })
    setFileList(fsCopy);
    console.log("fs copy-->" + JSON.stringify(fsCopy));
  }


  async function playSound(path, playDuration) {
    const { sound } = await Audio.Sound.createAsync(
      { uri: path }, {}, onPlaybackStatusUpdate, true
    );
    setSound(sound);
    await sound.playAsync();
  }

  async function stopSound(path) {
    await sound.stopAsync();
  }

  async function pauseSound() {
    await sound.pauseAsync();
  }

  //Delete audio file fn
  async function deleteFile(path) {
    let fs = filesList.filter(f => f.pathF != path);
    setFileList(fs);
    await FileSystem.deleteAsync(path);
    getFileList();
  }

  //Share file function
  async function shareFile(path) {
    if (!(await Sharing.isAvailableAsync())) {
      alert(`Uh oh, sharing isn't available on your platform`);
      return;
    }

    await Sharing.shareAsync(path);
  }

  //Cards with audioname, stop, delete and share options
  const Item = ({ title, path, duration, playDuration, isPlaying }) => {
    let visble = false;
    return (
      title ? <Card style={{ margin: 2, backgroundColor: "#ffe6cc" }}>
        <View style={{ flexDirection: 'row', alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => playSound(path, playDuration)} >
              <View style={styles.item}>
                <Text style={{ fontSize: 18 }}>{title}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', justifyContent: "flex-end", alignItems: 'center' }}>
            <Button icon={isPlaying ? "stop" : "play"} labelStyle={{ fontSize: 35, color: isPlaying ? "#ff471a" : "#e67300" }}
              onPress={isPlaying ? () => stopSound(path) : () => playSound(path, playDuration)} />

            <Button icon="trash-can" labelStyle={{ fontSize: 30, color: "#e67300" }} onPress={() => deleteFile(path)} />
            <Button icon="share-variant" labelStyle={{ fontSize: 30, color: "#e67300" }} onPress={() => shareFile(path)} />

          </View>
        </View>
        <View>
          <View style={{ display: "flex", flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Slider value={playDuration ? duration - playDuration : 0}
                onValueChange={async (value) => {
                  console.log("in value change")
                  await updatePlayback(value, path)
                }}
                minimumValue={0}
                maximumValue={duration}
                step={1}
                thumbTintColor="#e67300"
                minimumTrackTintColor="#e67300"
                trackStyle={{ height: 50 }}
              />
            </View>
            <View style={{ marginHorizontal: 5 }}>
              <Text style={{ fontSize: 16, color: playDuration ? "#ff471a" : "black" }}>{playDuration ? getMMSSFromMillis(playDuration) : getMMSSFromMillis(duration)}</Text>
            </View>
          </View>
        </View>
      </Card> : <View />

    )
  };

  function sortedFileList() {
    if (filesList.length > 0) {
      return filesList.sort(function (a, b) {
        return b.ts - a.ts;
      })
    }
    else {
      return []
    }
  }

  //Render function
  return (
    <SafeAreaView style={styles.container}>
      <View style={{ display: "flex", flexDirection: 'row', alignContent: "center", justifyContent: "space-between", marginTop: 20 }}>
        <View style={{ borderWidth: 1, borderColor: '#e67300', flex: 1 }}>
          <TextInput
            placeholder="Enter Audio name"
            editable
            maxLength={40}
            onChangeText={text => setFileName(text)}
            value={fileName}
            style={{ padding: 10, color: "#e67300" }}
          />
        </View>
        <View style={{ flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <View>
            <Button
              style={{ marginLeft: 20 }}
              labelStyle={{ fontSize: 35, color: fileName ? recording ? "red" : "green" : "grey" }}
              icon="record-circle"
              onPress={recording ? stopRecording : startRecording}
              disabled={fileName ? false : true}
            />
          </View>
          <View>
            <Text style={{ fontSize: 18, color: 'red' }}>{getRecordingTimestamp()}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 10, flexDirection: 'row' }}>
        <Text style={{ fontSize: 18, color: 'black' }} >Metering</Text>
        <Text style={{ fontSize: 18, color: '#e67300' }} > {metering} dbFS</Text>
      </View>

      <View style={{ paddingVertical: 10 }}>
        <View style={{ marginTop: 10, flexDirection: 'row' }}>

          <Text style={{ fontSize: 18 }}>Threshold Value :</Text>
          <Text style={{ fontSize: 18, color: '#e67300' }}>{threshold} dB</Text>
        </View>
        <Slider value={threshold}
          onValueChange={(value) => setThreshold(value)}
          minimumValue={10}
          maximumValue={100}
          step={1}
          thumbTintColor="#e67300"
          minimumTrackTintColor="#e67300"
          trackStyle={{ height: 50 }}
        />
      </View>

      <View style={{ paddingTop: 10, paddingBottom: 20 }}>
        <View style={{ marginTop: 10, flexDirection: 'row' }}>

          <Text style={{ fontSize: 18 }}>Compress Level :</Text>
          <Text style={{ fontSize: 18, color: '#e67300' }}>{compress} dB</Text>
        </View>
        <Slider value={compress}
          onValueChange={(value) => setCompress(value)}
          minimumValue={1}
          maximumValue={10}
          step={1}
          thumbTintColor="#e67300"
          minimumTrackTintColor="#e67300"
          trackStyle={{ height: 50 }}
        />
      </View>


      <View style={{ flex: 1 }}>
        {filesList.length > 0 && <FlatList
          data={sortedFileList()}
          renderItem={renderItem}
          keyExtractor={(item, index) => { return item.ts + '' }}

        />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: '#ecf0f1',
    padding: 10,
  },
  item: {
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 32,
  },
});

